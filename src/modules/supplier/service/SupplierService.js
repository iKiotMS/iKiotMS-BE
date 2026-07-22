const mongoose = require("mongoose");
const { Supplier, CashFlow, Tenant, SupplierPaymentIntent } = require("../../../models");
const { REFERENCE_PREFIX } = require("../../../constants/referencePrefix");
const { generateReference } = require("../../../utils/referenceGenerator");
const NotificationService = require("../../../services/notificationService");
const sepayService = require("../../../services/sepayService");
const { emitToRoom } = require("../../../services/socketService");

class SupplierService {
  async create(tenantId, data) {
    const supplier = new Supplier({
      ...data,
      tenantId,
      outstandingDebt: 0, // Always starts at 0
    });
    await supplier.save();
    return supplier;
  }

  async getList(tenantId, query) {
    const { page = 1, limit = 10, search, hasDebt } = query;
    const skip = (page - 1) * limit;

    const filter = { tenantId };
    
    if (search) {
      filter.$or = [
        { supplierName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (hasDebt === 'true') {
      filter.outstandingDebt = { $gt: 0 };
    }

    const [data, total] = await Promise.all([
      Supplier.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }).lean(),
      Supplier.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDetail(tenantId, supplierId) {
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId }).lean();
    if (!supplier) {
      throw new Error("Supplier not found");
    }
    return supplier;
  }

  async update(tenantId, supplierId, updateData) {
    // Prevent manual update of outstandingDebt via normal update
    if (updateData.outstandingDebt !== undefined) {
      delete updateData.outstandingDebt;
    }

    const supplier = await Supplier.findOneAndUpdate(
      { _id: supplierId, tenantId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!supplier) {
      throw new Error("Supplier not found");
    }
    return supplier;
  }

  async delete(tenantId, supplierId) {
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId });
    if (!supplier) {
      throw new Error("Supplier not found");
    }

    if (supplier.outstandingDebt > 0) {
      throw new Error("Cannot delete supplier with outstanding debt");
    }

    await Supplier.findByIdAndDelete(supplierId);
    return supplier;
  }

  // Generate a QR URL for BANK_TRANSFER without modifying any data.
  // Call this BEFORE the user transfers, then call payDebt after confirmation.
  async initiateQr(tenantId, supplierId, amount, userId, note) {
    if (!amount || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const [supplier, tenant] = await Promise.all([
      Supplier.findOne({ _id: supplierId, tenantId }).lean(),
      Tenant.findById(tenantId).lean(),
    ]);

    if (!supplier) throw new Error("Supplier not found");
    if (supplier.outstandingDebt < amount) {
      throw new Error("Payment amount exceeds outstanding debt");
    }
    if (!tenant?.banking?.accountNumber || !tenant?.banking?.bankName) {
      throw new Error("Tenant has not configured banking information");
    }

    const paymentReference = generateReference(REFERENCE_PREFIX.SUPPLIER);

    // Save the intent so the webhook can look it up when money arrives
    await SupplierPaymentIntent.create({
      tenantId,
      supplierId,
      createdBy: userId,
      amount,
      paymentReference,
      note,
    });

    const qrUrl = sepayService.buildTenantQrUrl(tenant.banking, amount, paymentReference);
    return { qrUrl, paymentReference };
  }

  async payDebt(user, supplierId, payload) {
    const { tenantId, userId } = user;
    const { amount, paymentMethod, note } = payload;
    
    if (!amount || amount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Find supplier and lock it
      const supplier = await Supplier.findOne({ _id: supplierId, tenantId }).session(session);
      if (!supplier) {
        throw new Error("Supplier not found");
      }

      if (supplier.outstandingDebt < amount) {
        throw new Error("Payment amount exceeds outstanding debt");
      }

      // 2. Decrease outstandingDebt
      supplier.outstandingDebt -= amount;
      await supplier.save({ session });

      // 3. Create CashFlow (Expense) - Tenant Level (No branchId)
      const cashFlow = new CashFlow({
        tenantId,
        flowType: "EXPENSE",
        amount,
        paymentMethod: paymentMethod || "CASH",
        createdBy: userId,
        supplierId,
        paymentReference: generateReference(REFERENCE_PREFIX.SUPPLIER),
        description: note || `Thanh toán công nợ cho nhà cung cấp ${supplier.supplierName}`,
      });
      await cashFlow.save({ session });

      await session.commitTransaction();
      session.endSession();

      // 4. Send Notification
      const ownerIds = await NotificationService.approversOf({ tenantId, locationId: null, locationType: "tenant" });
      const ownerIdsFiltered = ownerIds.filter(id => String(id) !== String(userId));
      
      if (ownerIdsFiltered.length > 0) {
        await NotificationService.notify({
          tenantId,
          recipientIds: ownerIdsFiltered,
          type: "SYSTEM",
          title: "Thanh toán công nợ nhà cung cấp",
          description: `Đã trả nhà cung cấp ${supplier.supplierName} ${amount.toLocaleString()} VNĐ. Còn nợ ${(supplier.outstandingDebt).toLocaleString()} VNĐ.`,
        });
      }

      return {
        supplier,
        paymentTransaction: cashFlow,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // Called by the SePay webhook when a SUP-prefixed transfer arrives.
  // Completes the payment atomically and emits a socket event to the waiting FE dialog.
  async completeDebtPayment(tenantId, paymentReference, transferAmount) {
    // 1. Find and claim the pending intent
    const intent = await SupplierPaymentIntent.findOneAndUpdate(
      { paymentReference, tenantId, status: "PENDING" },
      { $set: { status: "COMPLETED" } },
      { new: true }
    );
    if (!intent) {
      // Already processed or expired
      return null;
    }

    if (transferAmount < intent.amount) {
      throw new Error(
        `Underpaid: expected ${intent.amount}, received ${transferAmount}`
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Deduct outstanding debt
      const supplier = await Supplier.findOne({ _id: intent.supplierId, tenantId }).session(session);
      if (!supplier) throw new Error("Supplier not found");

      if (supplier.outstandingDebt < intent.amount) {
        throw new Error("Payment amount exceeds current outstanding debt");
      }

      supplier.outstandingDebt -= intent.amount;
      await supplier.save({ session });

      // 3. Create CashFlow record
      const cashFlow = new CashFlow({
        tenantId,
        flowType: "EXPENSE",
        amount: intent.amount,
        paymentMethod: "BANK_TRANSFER",
        createdBy: intent.createdBy,
        supplierId: intent.supplierId,
        paymentReference,
        description: intent.note || `Thanh toán công nợ cho nhà cung cấp ${supplier.supplierName}`,
      });
      await cashFlow.save({ session });

      await session.commitTransaction();

      // 4. Emit socket event to FE dialog waiting on this payment reference
      emitToRoom(`supplier-payment:${paymentReference}`, "supplier:debt-paid", {
        paymentReference,
        supplierId: String(intent.supplierId),
        paidAmount: intent.amount,
        supplier: supplier.toObject(),
      });

      // 5. Notify owners
      const ownerIds = await NotificationService.approversOf({ tenantId, locationId: null, locationType: "tenant" });
      const ownerIdsFiltered = ownerIds.filter(id => String(id) !== String(intent.createdBy));
      if (ownerIdsFiltered.length > 0) {
        await NotificationService.notify({
          tenantId,
          recipientIds: ownerIdsFiltered,
          type: "SYSTEM",
          title: "Thanh toán công nợ nhà cung cấp",
          description: `Đã nhận chuyển khoản ${intent.amount.toLocaleString()} VNĐ từ tài khoản ngân hàng cho nhà cung cấp ${supplier.supplierName}.`,
        });
      }

      return supplier;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new SupplierService();

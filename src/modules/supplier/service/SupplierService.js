const mongoose = require("mongoose");
const { Supplier, CashFlow } = require("../../../models");
const { REFERENCE_PREFIX } = require("../../../constants/referencePrefix");
const { generateReference } = require("../../../utils/referenceGenerator");
const NotificationService = require("../../../services/notificationService");

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
}

module.exports = new SupplierService();

const mongoose = require("mongoose");
const {
  Order,
  CashFlow,
  Customer,
  Branch,
  ProductItem,
  Inventory,
  Tenant,
} = require("../../../models");
const sepayService = require("../../../services/sepayService");
const { emitToRoom } = require("../../../services/socketService");

const INSTANT_COMPLETE_METHODS = ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY"];

const VALID_TRANSITIONS = {
  PENDING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

class OrderService {
  async createOrder(tenantId, userId, dto) {
    const { customerId, branchId, paymentMethod, items, grandTotal, customerPay, note } = dto;

    // Pre-flight checks (outside transaction for read performance)
    const [customer, branch, tenant] = await Promise.all([
      Customer.findOne({ _id: customerId, tenantId }).lean(),
      Branch.findOne({ _id: branchId, tenantId }).lean(),
      paymentMethod === "SEPAY" ? Tenant.findById(tenantId).select("+banking.sepayWebhookApiKey").lean() : null,
    ]);
    if (!customer) throw new Error("Customer not found");
    if (!branch) throw new Error("Branch not found");

    if (paymentMethod === "SEPAY" && (!tenant?.banking?.accountNumber || !tenant?.banking?.bankName)) {
      throw new Error("Tenant has not configured banking information for SEPAY payment");
    }

    for (const item of items) {
      const [productItem, inventory] = await Promise.all([
        ProductItem.findOne({ _id: item.productItemId, tenantId }).lean(),
        Inventory.findOne({
          productItemId: item.productItemId,
          locationId: branchId,
          locationType: "branch",
        }).lean(),
      ]);
      if (!productItem) throw new Error(`Product item not found: ${item.productItemId}`);
      if (!inventory || inventory.stock < item.quantity) {
        throw new Error(`Insufficient stock for: ${productItem.sku || item.productItemId}`);
      }
    }

    const isSepay = paymentMethod === "SEPAY";
    const status = INSTANT_COMPLETE_METHODS.includes(paymentMethod) ? "COMPLETED" : "PENDING";
    // SEPAY ref generated before insert (needed for QR URL); CASH ref derived from _id after insert
    const sepayRef = isSepay ? sepayService.generateOrderRef() : undefined;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [order] = await Order.create(
        [
          {
            tenantId,
            branchId,
            customerId,
            userId,
            paymentMethod,
            paymentReference: sepayRef,
            grandTotal,
            customerPay,
            change: customerPay != null ? Math.max(0, customerPay - grandTotal) : undefined,
            note,
            status,
            items: items.map((item) => ({
              productItemId: item.productItemId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount || 0,
            })),
          },
        ],
        { session },
      );

      // CASH: assign ref from ObjectId — guaranteed unique, no collision possible
      if (!isSepay) {
        order.paymentReference = `CASH${order._id.toString().slice(-8).toUpperCase()}`;
        await order.save({ session });
      }

      // Deduct inventory for all payment methods (reserve stock immediately)
      for (const item of items) {
        await Inventory.findOneAndUpdate(
          { productItemId: item.productItemId, locationId: branchId, locationType: "branch" },
          { $inc: { stock: -item.quantity } },
          { session },
        );
      }

      if (status === "COMPLETED") {
        await CashFlow.create(
          [
            {
              tenantId,
              branchId,
              orderId: order._id,
              flowType: "INCOME",
              amount: grandTotal,
              paymentMethod,
              description: `Order ${order._id}`,
            },
          ],
          { session },
        );
      }

      await session.commitTransaction();

      let qrUrl;
      if (isSepay && tenant?.banking) {
        qrUrl = sepayService.buildTenantQrUrl(tenant.banking, grandTotal, sepayRef);
      }

      return { order, qrUrl };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async getOrders(tenantId, query) {
    const { page, limit, status, paymentMethod, customerId, branchId, search, fromDate, toDate } =
      query;
    const skip = (page - 1) * limit;
    const filter = { tenantId };

    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (branchId) filter.branchId = branchId;

    if (customerId) {
      filter.customerId = customerId;
    } else if (search) {
      const customers = await Customer.find({
        tenantId,
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();
      filter.customerId = { $in: customers.map((c) => c._id) };
    }

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "name phone")
        .populate("userId", "name")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(tenantId, orderId) {
    const order = await Order.findOne({ _id: orderId, tenantId })
      .populate("customerId", "name phone")
      .populate("userId", "name")
      .populate("items.productItemId", "sku productName")
      .lean();
    if (!order) throw new Error("Order not found");
    return order;
  }

  async updateOrderStatus(tenantId, orderId, newStatus) {
    const order = await Order.findOne({ _id: orderId, tenantId });
    if (!order) throw new Error("Order not found");

    if (!VALID_TRANSITIONS[order.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition order from ${order.status} to ${newStatus}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      order.status = newStatus;
      await order.save({ session });

      if (newStatus === "CANCELLED" || newStatus === "RETURNED") {
        for (const item of order.items) {
          await Inventory.findOneAndUpdate(
            {
              productItemId: item.productItemId,
              locationId: order.branchId,
              locationType: "branch",
            },
            { $inc: { stock: item.quantity } },
            { session },
          );
        }
      }

      if (newStatus === "COMPLETED") {
        await CashFlow.create(
          [
            {
              tenantId,
              branchId: order.branchId,
              orderId: order._id,
              flowType: "INCOME",
              amount: order.grandTotal,
              paymentMethod: order.paymentMethod,
              description: `Order ${order._id}`,
            },
          ],
          { session },
        );
      }

      if (newStatus === "RETURNED") {
        await CashFlow.create(
          [
            {
              tenantId,
              branchId: order.branchId,
              orderId: order._id,
              flowType: "EXPENSE",
              amount: order.grandTotal,
              paymentMethod: order.paymentMethod,
              description: `Return order ${order._id}`,
            },
          ],
          { session },
        );
      }

      await session.commitTransaction();
      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async completeSepayOrder(tenantId, paymentReference, sepayTransactionId, transferAmount) {
    const order = await Order.findOne({
      paymentReference,
      status: "PENDING",
      paymentMethod: "SEPAY",
      tenantId,
    });
    if (!order) return null;

    if (transferAmount < order.grandTotal) {
      throw new Error(
        `Underpaid: expected ${order.grandTotal}, received ${transferAmount}`,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      order.status = "COMPLETED";
      order.sepayTransactionId = sepayTransactionId;
      await order.save({ session });

      await CashFlow.create(
        [
          {
            tenantId: order.tenantId,
            branchId: order.branchId,
            orderId: order._id,
            flowType: "INCOME",
            amount: transferAmount,
            paymentMethod: "SEPAY",
            description: `SePay - ${order.paymentReference}`,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      emitToRoom(`order:${order._id}`, "order:paid", {
        orderId: order._id,
        status: order.status,
        paidAmount: transferAmount,
      });

      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new OrderService();

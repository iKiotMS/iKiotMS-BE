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
const NotificationService = require("../../../services/notificationService");
const InventoryService = require("../../inventory/service/InventoryService");
const { attachUserName, USER_NAME_SELECT } = require("../../../utils/userName");

const INSTANT_COMPLETE_METHODS = ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY"];

const VALID_TRANSITIONS = {
  PENDING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

class OrderService {
  async createOrder(tenantId, userId, dto) {
    const {
      customerId,
      branchId,
      paymentMethod,
      items,
      grandTotal,
      customerPay,
      note,
    } = dto;

    let customer;
    if (customerId) {
      customer = await Customer.findOne({ _id: customerId, tenantId }).lean();
      if (!customer) throw new Error("Customer not found");
    } else {
      customer = await Customer.findOneAndUpdate(
        { tenantId, customerCode: "KH_VANGLAI" },
        {
          $setOnInsert: {
            tenantId,
            customerCode: "KH_VANGLAI",
            name: "Khách vãng lai",
            gender: "OTHER",
            isDeleted: false,
          },
        },
        { upsert: true, new: true, lean: true },
      );
    }

    const [branch, tenant] = await Promise.all([
      Branch.findOne({ _id: branchId, tenantId }).lean(),
      paymentMethod === "SEPAY"
        ? Tenant.findById(tenantId).select("+banking.sepayWebhookApiKey").lean()
        : null,
    ]);
    if (!branch) throw new Error("Branch not found");

    if (
      paymentMethod === "SEPAY" &&
      (!tenant?.banking?.accountNumber || !tenant?.banking?.bankName)
    ) {
      throw new Error(
        "Tenant has not configured banking information for SEPAY payment",
      );
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
      if (!productItem)
        throw new Error(`Product item not found: ${item.productItemId}`);
      if (!inventory || inventory.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for: ${productItem.sku || item.productItemId}`,
        );
      }
    }

    const isSepay = paymentMethod === "SEPAY";
    const status = INSTANT_COMPLETE_METHODS.includes(paymentMethod)
      ? "COMPLETED"
      : "PENDING";
    // Every order gets an ORD ref regardless of payment method, so an ORD prefix on a
    // CashFlow row always means "sales revenue". Only SEPAY puts it in the QR.
    const orderRef = sepayService.generateOrderRef();

    const lowStockCrossings = [];

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [order] = await Order.create(
        [
          {
            tenantId,
            branchId,
            customerId: customer._id,
            userId,
            paymentMethod,
            paymentReference: orderRef,
            grandTotal,
            customerPay,
            change:
              customerPay != null
                ? Math.max(0, customerPay - grandTotal)
                : undefined,
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

      // Bán hàng cũng trừ kho, nên cũng phải theo dõi ngưỡng cảnh báo. Chỉ gom
      // ở đây; cảnh báo được gửi sau khi transaction commit (xem bên dưới).
      for (const item of items) {
        const updated = await Inventory.findOneAndUpdate(
          {
            productItemId: item.productItemId,
            locationId: branchId,
            locationType: "branch",
          },
          { $inc: { stock: -item.quantity } },
          { session, new: true },
        );

        lowStockCrossings.push(
          InventoryService.lowStockCrossing(updated, -item.quantity),
        );
      }

      if (status === "COMPLETED") {
        await CashFlow.create(
          [
            {
              tenantId,
              branchId,
              orderId: order._id,
              createdBy: userId,
              flowType: "INCOME",
              amount: grandTotal,
              paymentMethod,
              paymentReference: order.paymentReference,
              description: `Order ${order._id}`,
            },
          ],
          { session },
        );
      }

      await session.commitTransaction();

      // Sau commit: kho đã trừ thật, giờ mới cảnh báo mặt hàng vừa tụt ngưỡng.
      await InventoryService.notifyLowStock(lowStockCrossings);

      let qrUrl;
      if (isSepay && tenant?.banking) {
        qrUrl = sepayService.buildTenantQrUrl(
          tenant.banking,
          grandTotal,
          orderRef,
        );
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
    const {
      page,
      limit,
      status,
      paymentMethod,
      customerId,
      branchId,
      search,
      fromDate,
      toDate,
    } = query;
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
        .populate("userId", USER_NAME_SELECT)
        .lean(),
      Order.countDocuments(filter),
    ]);

    data.forEach((o) => attachUserName(o.userId));

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(tenantId, orderId) {
    const order = await Order.findOne({ _id: orderId, tenantId })
      .populate("customerId", "name phone")
      .populate("userId", USER_NAME_SELECT)
      .populate("items.productItemId", "sku productName")
      .lean();
    if (!order) throw new Error("Order not found");
    attachUserName(order.userId);
    return order;
  }

  async updateOrderStatus(tenantId, orderId, newStatus) {
    const order = await Order.findOne({ _id: orderId, tenantId });
    if (!order) throw new Error("Order not found");

    if (!VALID_TRANSITIONS[order.status]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition order from ${order.status} to ${newStatus}`,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: order.status },
        { $set: { status: newStatus } },
        { new: true, session },
      );
      if (!updated) {
        throw new Error("Order status changed concurrently, please retry");
      }

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
              createdBy: order.userId,
              flowType: "INCOME",
              amount: order.grandTotal,
              paymentMethod: order.paymentMethod,
              paymentReference: order.paymentReference,
              description: `Order ${order._id}`,
            },
          ],
          { session },
        );
      }

      if (newStatus === "RETURNED") {
        const income = await CashFlow.findOne({
          orderId: order._id,
          flowType: "INCOME",
        })
          .session(session)
          .lean();

        await CashFlow.create(
          [
            {
              tenantId,
              branchId: order.branchId,
              orderId: order._id,
              createdBy: order.userId,
              flowType: "EXPENSE",
              amount: income?.amount ?? order.grandTotal,
              paymentMethod: order.paymentMethod,
              paymentReference: order.paymentReference,
              description: `Return order ${order._id}`,
            },
          ],
          { session },
        );
      }

      await session.commitTransaction();
      return updated;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async payOfflineForSepayOrder(tenantId, orderId, userId, dto) {
    const pending = await Order.findOne({
      _id: orderId,
      tenantId,
      status: "PENDING",
      paymentMethod: "SEPAY",
    }).lean();
    if (!pending)
      throw new Error("Order not found or no longer awaiting SePay payment");

    const customerPay = dto.customerPay ?? pending.grandTotal;
    if (customerPay < pending.grandTotal) {
      throw new Error(
        `Underpaid: expected ${pending.grandTotal}, received ${customerPay}`,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findOneAndUpdate(
        { _id: pending._id, status: "PENDING", paymentMethod: "SEPAY" },
        {
          $set: {
            status: "COMPLETED",
            paymentMethod: dto.paymentMethod,
            customerPay,
            change: Math.max(0, customerPay - pending.grandTotal),
            ...(dto.note ? { note: dto.note } : {}),
          },
        },
        { new: true, session },
      );
      if (!order) {
        throw new Error("Order was already paid or cancelled, please refresh");
      }

      await CashFlow.create(
        [
          {
            tenantId: order.tenantId,
            branchId: order.branchId,
            orderId: order._id,
            createdBy: userId,
            flowType: "INCOME",
            amount: order.grandTotal,
            paymentMethod: dto.paymentMethod,
            paymentReference: order.paymentReference,
            description: `Offline payment (${dto.paymentMethod}) for SePay order ${order.paymentReference}`,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      emitToRoom(`order:${order._id}`, "order:paid", {
        orderId: order._id,
        status: order.status,
        paidAmount: order.grandTotal,
        paymentMethod: order.paymentMethod,
      });

      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async completeSepayOrder(
    tenantId,
    paymentReference,
    sepayTransactionId,
    transferAmount,
  ) {
    const pending = await Order.findOne({
      paymentReference,
      status: "PENDING",
      paymentMethod: "SEPAY",
      tenantId,
    }).lean();
    if (!pending) {
      const settled = await Order.findOne({ paymentReference, tenantId })
        .select("_id status paymentMethod grandTotal")
        .lean();
      if (settled) {
        console.warn(
          `[SePay] Transfer ${sepayTransactionId} (${transferAmount}) for ${paymentReference} ignored — ` +
            `order ${settled._id} is already ${settled.status} via ${settled.paymentMethod}. Manual refund may be required.`,
        );
      }
      return null;
    }

    if (transferAmount < pending.grandTotal) {
      throw new Error(
        `Underpaid: expected ${pending.grandTotal}, received ${transferAmount}`,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findOneAndUpdate(
        { _id: pending._id, status: "PENDING" },
        { $set: { status: "COMPLETED", sepayTransactionId } },
        { new: true, session },
      );
      if (!order) {
        await session.abortTransaction();
        return null;
      }

      await CashFlow.create(
        [
          {
            tenantId: order.tenantId,
            branchId: order.branchId,
            orderId: order._id,
            createdBy: order.userId,
            flowType: "INCOME",
            amount: transferAmount,
            paymentMethod: "SEPAY",
            paymentReference: order.paymentReference,
            sepayTransactionId,
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
        paymentMethod: "SEPAY",
      });

      // Xác nhận từ SePay đến bất đồng bộ qua webhook — thu ngân có thể không
      // còn nhìn màn hình, nên đây là chỗ push thật sự có giá trị. Báo cho nhân
      // viên tạo đơn và quản lý chi nhánh.
      const branchManagers = await NotificationService.managersOfLocation({
        tenantId: order.tenantId,
        locationId: order.branchId,
        locationType: "branch",
      });

      await NotificationService.notify({
        tenantId: order.tenantId,
        recipientIds: [order.userId, ...branchManagers],
        type: "ORDER_PAID",
        title: "Khách đã thanh toán",
        description: `Đơn hàng ${order.paymentReference} đã nhận được ${transferAmount.toLocaleString("vi-VN")}đ qua chuyển khoản.`,
        link: `/sales/invoices`,
        referenceId: order._id,
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

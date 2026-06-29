const { Customer, Order } = require("../../../models");

class CustomerService {
  async createCustomer(tenantId, data) {
    const customer = await Customer.create({ tenantId, ...data });
    return customer;
  }

  async getCustomers(tenantId, { page, limit, search, branchId }) {
    const skip = (page - 1) * limit;
    const filter = { tenantId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (branchId) {
      const orders = await Order.find({ tenantId, branchId }).select("customerId").lean();
      const customerIds = orders.map((o) => o.customerId);
      filter._id = { $in: customerIds };
    }

    const [data, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    const customerIds = data.map((c) => c._id);
    const orderFilter = { tenantId, customerId: { $in: customerIds } };
    if (branchId) {
      orderFilter.branchId = branchId;
    }

    const orders = await Order.find(orderFilter)
      .populate("branchId", "name")
      .populate("userId", "name")
      .lean();

    const customerOrdersMap = {};
    orders.forEach((o) => {
      if (!customerOrdersMap[o.customerId]) {
        customerOrdersMap[o.customerId] = [];
      }
      customerOrdersMap[o.customerId].push({
        id: o._id.toString(),
        branchName: o.branchId?.name || "Chi nhánh chính",
        status: o.status,
        staffName: o.userId?.name || "Nhân viên",
        paymentMethod: o.paymentMethod,
        grandTotal: o.grandTotal,
        items: o.items.map((item) => ({
          productName: item.productName || "Sản phẩm",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        createdAt: o.createdAt,
      });
    });

    const enrichedData = data.map((c) => ({
      ...c,
      id: c._id.toString(),
      orders: customerOrdersMap[c._id] || [],
    }));

    return {
      data: enrichedData,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCustomerById(tenantId, customerId) {
    const customer = await Customer.findOne({ _id: customerId, tenantId }).lean();
    if (!customer) throw new Error("Customer not found");
    return customer;
  }

  async updateCustomer(tenantId, customerId, updateFields) {
    const customer = await Customer.findOneAndUpdate(
      { _id: customerId, tenantId },
      { $set: updateFields },
      { new: true, runValidators: true },
    );
    if (!customer) throw new Error("Customer not found");
    return customer;
  }

  async deleteCustomer(tenantId, customerId) {
    const customer = await Customer.findOneAndDelete({ _id: customerId, tenantId });
    if (!customer) throw new Error("Customer not found");
    return customer;
  }

  async deleteManyCustomers(tenantId, customerIds) {
    const result = await Customer.deleteMany({ _id: { $in: customerIds }, tenantId });
    return result;
  }
}

module.exports = new CustomerService();

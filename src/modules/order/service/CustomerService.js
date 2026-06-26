const { Customer } = require("../../../models");

class CustomerService {
  async createCustomer(tenantId, data) {
    const customer = await Customer.create({ tenantId, ...data });
    return customer;
  }

  async getCustomers(tenantId, { page, limit, search }) {
    const skip = (page - 1) * limit;
    const filter = { tenantId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    return {
      data,
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
}

module.exports = new CustomerService();

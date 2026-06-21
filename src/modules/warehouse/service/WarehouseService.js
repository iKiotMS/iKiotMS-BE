const Warehouse = require("../../../models/Warehouse");
const { WAREHOUSE_STATUS } = require("../../../constants/warehouseConstants");

class WarehouseService {
  async createWarehouse(tenantId, warehouseData) {
    const warehouse = new Warehouse({
      tenantId,
      name: warehouseData.name,
      address: warehouseData.address,
    });

    await warehouse.save();
    return warehouse;
  }

  async getWarehouses(tenantId, queryParams) {
    const { page, limit, search, status } = queryParams;
    const skip = (page - 1) * limit;

    const filter = { tenantId };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (status) {
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      Warehouse.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Warehouse.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWarehouseById(tenantId, warehouseId) {
    const warehouse = await Warehouse.findOne({ _id: warehouseId, tenantId }).lean();
    if (!warehouse) {
      throw new Error("Warehouse not found");
    }
    return warehouse;
  }

  async updateWarehouse(tenantId, warehouseId, updateData) {
    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: warehouseId, tenantId },
      { $set: updateData },
      { new: true }
    );

    if (!warehouse) {
      throw new Error("Warehouse not found");
    }

    return warehouse;
  }

  async softDeleteWarehouse(tenantId, warehouseId) {
    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: warehouseId, tenantId },
      { $set: { status: WAREHOUSE_STATUS.INACTIVE } },
      { new: true }
    );

    if (!warehouse) {
      throw new Error("Warehouse not found");
    }

    return warehouse;
  }
}

module.exports = new WarehouseService();

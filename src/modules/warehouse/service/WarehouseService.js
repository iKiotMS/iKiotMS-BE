const Warehouse = require("../../../models/Warehouse");
const { User } = require("../../../models");
const { WAREHOUSE_STATUS } = require("../../../constants/warehouseConstants");

class WarehouseService {
  async createWarehouse(tenantId, warehouseData) {
    const warehouse = new Warehouse({
      tenantId,
      name: warehouseData.name,
      address: warehouseData.address,
      attendanceTakingLocation: warehouseData.attendanceTakingLocation,
    });

    await warehouse.save();
    return warehouse;
  }

  async getWarehouses(tenantId, queryParams) {
    const { page, limit, search, status } = queryParams;
    const skip = (page - 1) * limit;

    const filter = { tenantId, status: { $ne: WAREHOUSE_STATUS.DELETED } };

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
      { $set: { status: WAREHOUSE_STATUS.DELETED } },
      { new: true }
    );

    if (!warehouse) {
      throw new Error("Warehouse not found");
    }

    return warehouse;
  }

  async assignWarehouseManager({ tenantId, warehouseId, staffId }) {
    const session = await User.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        const warehouse = await Warehouse.findOne({
          _id: warehouseId,
          tenantId,
          status: { $ne: WAREHOUSE_STATUS.DELETED },
        }).session(session);

        if (!warehouse) {
          throw new Error("Warehouse not found");
        }

        const newManager = await User.findOne({
          _id: staffId,
          tenantId,
          role: "STAFF",
          status: "ACTIVE",
        }).session(session);

        if (!newManager) {
          throw new Error(
            "New warehouse manager must be an active staff member in this tenant",
          );
        }

        const currentManager = await User.findOne({
          tenantId,
          warehouseId,
          role: "WAREHOUSE_MANAGER",
          status: { $ne: "DELETED" },
        }).session(session);

        if (currentManager) {
          currentManager.role = "STAFF";
          await currentManager.save({ session });
        }

        newManager.role = "WAREHOUSE_MANAGER";
        newManager.branchId = null;
        newManager.warehouseId = warehouseId;
        await newManager.save({ session });

        const manager = await User.findById(newManager._id)
          .select("-password")
          .populate("branchId")
          .populate("warehouseId")
          .session(session)
          .lean();

        result = {
          warehouseId,
          manager,
        };
      });

      return result;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new WarehouseService();

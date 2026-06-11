const { User } = require("../../../models");
const BaseService = require("../../../common/services/BaseService");
const { STAFF_ROLES } = require("../../../constants/roles");
const { createStaffDTO, updateStaffDTO } = require("../dto/StaffDTO");

class StaffService extends BaseService {
  constructor() {
    super(User);
  }

  getStaffFilter(tenantId, extra = {}) {
    return {
      tenantId,
      role: { $in: STAFF_ROLES },
      ...extra,
    };
  }

  validateStaffRole(role) {
    if (!STAFF_ROLES.includes(role)) {
      throw new Error("Invalid staff role");
    }
  }

  async createStaff({ tenantId, data }) {
    this.validateStaffRole(data.role);

    const existingUser = await User.findOne({
      tenantId,
      phoneNumber: data.phoneNumber,
    });

    if (existingUser) {
      throw new Error("Phone number already exists");
    }

    return await this.create({
      tenantId,
      ...createStaffDTO(data),
    });
  }

  async getStaffList({ tenantId }) {
    return await this.findAll(this.getStaffFilter(tenantId), {
      select: "-password",
      populate: ["branchId", "warehouseId"],
    });
  }

  async getStaffById({ tenantId, staffId }) {
    return await this.findOne(this.getStaffFilter(tenantId, { _id: staffId }), {
      select: "-password",
      populate: ["branchId", "warehouseId"],
    });
  }

  async updateStaff({ tenantId, staffId, data }) {
    if (data.role) {
      this.validateStaffRole(data.role);
    }

    return await this.updateOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
      updateStaffDTO(data),
    );
  }

  async deleteStaff({ tenantId, staffId }) {
    return await this.deleteOne(this.getStaffFilter(tenantId, { _id: staffId }));
  }
}

module.exports = new StaffService();
const { Tenant } = require("../../models");

class BaseService {
  constructor(model) {
    this.model = model;
  }

  normalizeStaffRole(role) {
    if (!role || typeof role !== "string") {
      return null;
    }

    return role.trim().toUpperCase();
  }

  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  async validateTenantId(tenantId) {
    if (!tenantId) {
      throw new Error("Thiếu thông tin tenantId");
    }
    if (typeof tenantId !== "string") {
      throw new Error("tenantId phải là một chuỗi");
    }
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant không tồn tại");
    }
  }

  async validateUserId(userId) {
    if (!userId) {
      throw new Error("Thiếu thông tin userId");
    }
    if (typeof userId !== "string") {
      throw new Error("userId phải là một chuỗi");
    }
  }

  async hasPermissionToReadDataFromThisUser(user, readUserId) {
    const targetUser = await this.model.findById(readUserId).lean();
    if (!targetUser) {
      let error = Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (user.role === "BRANCH_MANAGER") {
      if (!user.branchId) {
        let error = new Error("Branch manager is not assigned to a branch");
        error.statusCode = 400;
        throw error;
      }

      if (
        targetUser.warehouseId ||
        targetUser.branchId?.toString() !== user.branchId.toString()
      ) {
        let error = new Error(
          "You do not have permission to read data from this user",
        );
        error.statusCode = 403;
        throw error;
      }
    } else if (user.role === "WAREHOUSE_MANAGER") {
      if (!user.warehouseId) {
        let error = new Error(
          "Warehouse manager is not assigned to a warehouse",
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        targetUser.branchId ||
        targetUser.warehouseId?.toString() !== user.warehouseId.toString()
      ) {
        let error = new Error(
          "You do not have permission to read data from this user",
        );
        error.statusCode = 403;
        throw error;
      }
    }
  }

  async create(data) {
    return await this.model.create(data);
  }

  async findAll(filter = {}, options = {}) {
    let query = this.model.find(filter);

    if (options.select) query = query.select(options.select);
    if (options.populate) {
      options.populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    return await query.lean();
  }

  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);

    if (options.select) query = query.select(options.select);
    if (options.populate) {
      options.populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    return await query.lean();
  }

  async updateOne(filter, data) {
    return await this.model.findOneAndUpdate(filter, data, {
      new: true,
      runValidators: true,
    });
  }

  async deleteOne(filter) {
    return await this.model.findOneAndDelete(filter);
  }
}

module.exports = BaseService;

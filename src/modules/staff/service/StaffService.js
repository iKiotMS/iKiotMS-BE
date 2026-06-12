const { User } = require("../../../models");
const BaseService = require("../../../common/services/baseService");
const { STAFF_ROLES } = require("../../../constants/role");
const { createStaffDTO, updateStaffDTO } = require("../dto/StaffDTO");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");

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

  normalizeStaffRole(role) {
    if (!role || typeof role !== "string") {
      return null;
    }

    return role.trim().toUpperCase();
  }

  validateStaffRole(role, { required = false } = {}) {
    const normalizedRole = this.normalizeStaffRole(role);

    if (!normalizedRole && required) {
      throw new Error("Staff role is required");
    }

    if (!normalizedRole) {
      return null;
    }

    if (!STAFF_ROLES.includes(normalizedRole)) {
      throw new Error(
        `Invalid staff role. Allowed roles: ${STAFF_ROLES.join(", ")}`,
      );
    }

    return normalizedRole;
  }

  checktenantId(tenantId) {
    if (!tenantId || tenantId === null || tenantId === undefined) {
      throw new Error("Tenant ID is required");
    }
  }

  async checkStaffId(staffId, tenantId) {
    if (!staffId || staffId === null || staffId === undefined) {
      throw new Error("Staff ID is required");
    }
    const staff = await User.findOne({
      _id: staffId,
      role: { $in: STAFF_ROLES },
      tenantId,
    });

    if (!staff) {
      throw new Error("Invalid staff ID");
    }
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

  buildKeywordFilter(keyword) {
    if (!keyword || !String(keyword).trim()) {
      return {};
    }

    const regex = new RegExp(String(keyword).trim(), "i");

    return {
      $or: [
        { email: regex },
        { phoneNumber: regex },
        { "profile.firstName": regex },
        { "profile.lastName": regex },
      ],
    };
  }

  buildStatusFilter(status) {
    if (!status) {
      return {};
    }

    const normalizedStatus = String(status).trim().toUpperCase();
    const allowedStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];

    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new Error(
        `Invalid status. Allowed statuses: ${allowedStatuses.join(", ")}`,
      );
    }

    return { status: normalizedStatus };
  }

  async buildStaffAccessFilter({
    tenantId,
    requesterId,
    requesterRole,
    requesterBranchId,
    requesterWarehouseId,
    branchId,
    warehouseId,
  }) {
    if (requesterRole === "TENANT_OWNER") {
      const filter = {};

      if (branchId) filter.branchId = branchId;
      if (warehouseId) filter.warehouseId = warehouseId;

      return filter;
    }

    if (requesterRole === "BRANCH_MANAGER") {
      const branchIdToUse =
        requesterBranchId ||
        (await this.getRequesterBranchId({
          tenantId,
          requesterId,
        }));

      if (!branchIdToUse) {
        throw new Error("Branch manager is not assigned to a branch");
      }

      return { branchId: branchIdToUse };
    }

    if (requesterRole === "WAREHOUSE_MANAGER") {
      const warehouseIdToUse =
        requesterWarehouseId ||
        (await this.getRequesterWarehouseId({
          tenantId,
          requesterId,
        }));

      if (!warehouseIdToUse) {
        throw new Error("Warehouse manager is not assigned to a warehouse");
      }

      return { warehouseId: warehouseIdToUse };
    }

    throw new Error("You do not have permission to view staff");
  }

  async getRequesterBranchId({ tenantId, requesterId }) {
    const requester = await User.findOne({ _id: requesterId, tenantId })
      .select("branchId")
      .lean();

    return requester?.branchId;
  }

  async getRequesterWarehouseId({ tenantId, requesterId }) {
    const requester = await User.findOne({ _id: requesterId, tenantId })
      .select("warehouseId")
      .lean();

    return requester?.warehouseId;
  }

  async createStaff({ tenantId, data, userRole }) {
    this.checktenantId(tenantId);
    data.role = this.validateStaffRole(data.role, { required: true });

    if (validateRoleHierarchy(userRole, data.role) === false)
      throw new Error(
        `Your role (${userRole}) do not have permission to create staff with role ${data.role}`,
      );

    const existingUser = await User.findOne({
      tenantId,
      phoneNumber: data.phoneNumber,
    });

    if (existingUser) {
      throw new Error("Phone number already exists");
    }

    if (data.email) {
      const existingEmail = await User.findOne({
        tenantId,
        email: data.email.toLowerCase().trim(),
      });

      if (existingEmail) {
        throw new Error("Email already exists");
      }
    }

    return await this.create(createStaffDTO(tenantId, data));
  }

  async getStaffList({
    tenantId,
    requesterId,
    requesterRole,
    requesterBranchId,
    requesterWarehouseId,
    branchId,
    warehouseId,
    page = 1,
    recordPerPage = 10,
    status,
    keyword,
    role,
  }) {
    this.checktenantId(tenantId);

    const pagination = this.getPagination({ page, recordPerPage });
    const accessFilter = await this.buildStaffAccessFilter({
      tenantId,
      requesterId,
      requesterRole,
      requesterBranchId,
      requesterWarehouseId,
      branchId,
      warehouseId,
    });

    const normalizedRole = this.validateStaffRole(role);
    const roleFilter = normalizedRole ? { role: normalizedRole } : {};
    const statusFilter = this.buildStatusFilter(status);
    const keywordFilter = this.buildKeywordFilter(keyword);
    const staffFilter = this.getStaffFilter(tenantId, {
      ...accessFilter,
      ...roleFilter,
      ...statusFilter,
      ...keywordFilter,
    });

    const [data, total] = await Promise.all([
      User.find(staffFilter)
        .select("-password")
        .populate("branchId")
        .populate("warehouseId")
        .skip(pagination.skip)
        .limit(pagination.recordPerPage)
        .lean(),
      User.countDocuments(staffFilter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: pagination.page,
        recordPerPage: pagination.recordPerPage,
        totalPages: Math.ceil(total / pagination.recordPerPage),
      },
    };
  }

  async getStaffById({ tenantId, staffId }) {
    this.checktenantId(tenantId);
    return await this.findOne(this.getStaffFilter(tenantId, { _id: staffId }), {
      select: "-password",
      populate: ["branchId", "warehouseId"],
    });
  }

  async updateStaff({ tenantId, staffId, data }) {
    this.checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    if (data.role) {
      data.role = this.validateStaffRole(data.role);
    }

    const updatedStaff = await User.findOneAndUpdate(
      this.getStaffFilter(tenantId, { _id: staffId }),
      updateStaffDTO(data),
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("branchId")
      .populate("warehouseId");

    if (!updatedStaff) {
      throw new Error(
        "Staff not found or you do not have permission to update",
      );
    }

    return {
      message: "Staff updated successfully",
      data: updatedStaff,
    };
  }

  async deleteStaff({ tenantId, staffId }) {
    this.checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    return await this.updateOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
      { status: "INACTIVE" },
    );
  }
}

module.exports = new StaffService();

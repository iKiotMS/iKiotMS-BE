const { User, Branch, Warehouse } = require("../../../models");
const BaseService = require("../../../common/services/baseService");
const { STAFF_ROLES } = require("../../../constants/role");
const {
  createStaffDTO,
  updateStaffDTO,
  createStaffAccountDTO,
} = require("../dto/StaffDTO");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");

class StaffService extends BaseService {
  constructor() {
    super(User);
  }

  getStaffFilter(tenantId, extra = {}) {
    return {
      tenantId,
      role: { $in: STAFF_ROLES },
      status: { $ne: "DELETED" },
      ...extra,
    };
  }

  validatePasswordCombo(data) {
    const passwordCombo = createStaffAccountDTO(data || {});

    if (!passwordCombo.newPassword || !passwordCombo.reEnterPassword) {
      throw new Error("Password and confirmation password are required");
    }

    if (passwordCombo.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    if (passwordCombo.newPassword !== passwordCombo.reEnterPassword) {
      throw new Error("Passwords do not match");
    }

    return passwordCombo;
  }

  async getStaffAccountResponse(staffId) {
    return await User.findById(staffId)
      .select("-password")
      .populate("branchId")
      .populate("warehouseId")
      .lean();
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
      status: { $ne: "DELETED" },
    });

    if (!staff) {
      throw new Error("Invalid staff ID");
    }
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

  validateSingleWorkplaceAssignment(role, branchId, warehouseId) {
    if (branchId && warehouseId) {
      throw new Error(
        "Staff can only be assigned to one branch or one warehouse",
      );
    }

    if (role === "BRANCH_MANAGER" && !branchId) {
      throw new Error("Branch manager must be assigned to a branch");
    }

    if (role === "BRANCH_MANAGER" && warehouseId) {
      throw new Error("Branch manager cannot be assigned to a warehouse");
    }

    if (role === "WAREHOUSE_MANAGER" && !warehouseId) {
      throw new Error("Warehouse manager must be assigned to a warehouse");
    }

    if (role === "WAREHOUSE_MANAGER" && branchId) {
      throw new Error("Warehouse manager cannot be assigned to a branch");
    }

    if (role === "STAFF" && !branchId && !warehouseId) {
      throw new Error("Staff must be assigned to a branch or warehouse");
    }
  }

  normalizeWorkplaceUpdateData(data) {
    // if API sends:
    // { branchId: "..." }
    // it automatically clears:
    // warehouseId = null
    if (data.branchId !== undefined && data.warehouseId === undefined) {
      data.warehouseId = null;
    }

    // if API sends:
    // { warehouseId: "..." }
    // it clears:
    // branchId = null
    if (data.warehouseId !== undefined && data.branchId === undefined) {
      data.branchId = null;
    }

    return data;
  }

  async getStaffWorkplace({ tenantId, staffId }) {
    this.checktenantId(tenantId);

    const staff = await User.findOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
    )
      .select("branchId warehouseId")
      .populate("branchId")
      .populate("warehouseId")
      .lean();

    if (!staff) {
      throw new Error("Invalid staff ID");
    }

    if (staff.branchId && staff.warehouseId) {
      throw new Error("Staff has invalid branch and warehouse assignment");
    }

    if (staff.branchId) {
      return {
        type: "BRANCH",
        branchId: staff.branchId._id,
        warehouseId: null,
        workplace: staff.branchId,
      };
    }

    if (staff.warehouseId) {
      return {
        type: "WAREHOUSE",
        branchId: null,
        warehouseId: staff.warehouseId._id,
        workplace: staff.warehouseId,
      };
    }

    return {
      type: null,
      branchId: null,
      warehouseId: null,
      workplace: null,
    };
  }

  async checkRoleAndBranchValidity(
    role,
    branchId,
    warehouseId,
    tenantId,
    staffIdToExclude = null,
  ) {
    this.validateSingleWorkplaceAssignment(role, branchId, warehouseId);

    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        tenantId,
      });

      if (!branch) {
        throw new Error("Branch not found");
      }
    }

    if (warehouseId) {
      const warehouse = await Warehouse.findOne({
        _id: warehouseId,
        tenantId,
      });

      if (!warehouse) {
        throw new Error("Warehouse not found");
      }
    }

    if (role === "BRANCH_MANAGER" && branchId) {
      const branchManagerFilter = {
        tenantId,
        branchId,
        role: "BRANCH_MANAGER",
      };

      if (staffIdToExclude) {
        branchManagerFilter._id = { $ne: staffIdToExclude };
      }

      const existingBranchManager = await User.findOne(branchManagerFilter);
      if (existingBranchManager) {
        throw new Error("This branch already has a branch manager assigned");
      }
    }

    if (role === "WAREHOUSE_MANAGER" && warehouseId) {
      const warehouseManagerFilter = {
        tenantId,
        warehouseId,
        role: "WAREHOUSE_MANAGER",
      };

      if (staffIdToExclude) {
        warehouseManagerFilter._id = { $ne: staffIdToExclude };
      }

      const existingWarehouseManager = await User.findOne(
        warehouseManagerFilter,
      );
      if (existingWarehouseManager) {
        throw new Error(
          "This warehouse already has a warehouse manager assigned",
        );
      }
    }
  }

  async checkStaffUniqueness({
    tenantId,
    phoneNumber,
    email,
    staffIdToExclude,
  }) {
    if (phoneNumber) {
      const phoneFilter = { tenantId, phoneNumber };

      if (staffIdToExclude) {
        phoneFilter._id = { $ne: staffIdToExclude };
      }

      const existingUser = await User.findOne(phoneFilter);

      if (existingUser) {
        throw new Error("Phone number already exists");
      }
    }

    if (email) {
      const emailFilter = {
        tenantId,
        email: email.toLowerCase().trim(),
      };

      if (staffIdToExclude) {
        emailFilter._id = { $ne: staffIdToExclude };
      }

      const existingEmail = await User.findOne(emailFilter);

      if (existingEmail) {
        throw new Error("Email already exists");
      }
    }
  }

  async createStaff({ tenantId, data, userRole, subscription }) {
    this.checktenantId(tenantId);
    data = this.normalizeWorkplaceUpdateData(data || {});
    data.role = this.validateStaffRole(data.role, { required: true });

    if (validateRoleHierarchy(userRole, data.role) === false)
      throw new Error(
        `Your role (${userRole}) do not have permission to create staff with role ${data.role}`,
      );

    await this.checkRoleAndBranchValidity(
      data.role,
      data.branchId,
      data.warehouseId,
      tenantId,
    );

    await this.checkStaffUniqueness({
      tenantId,
      phoneNumber: data.phoneNumber,
      email: data.email,
    });
    // Check user quota
    if (subscription) {
      const maxUsers = subscription.currentQuotaSnapshot.maxUsers;
      if (maxUsers > 0) {
        // -1 means unlimited
        const staffCount = await User.countDocuments({
          tenantId,
          role: { $in: STAFF_ROLES },
          status: { $ne: "DELETED" },
        });
        if (staffCount >= maxUsers) {
          throw new Error(
            `User limit reached. Your plan allows ${maxUsers} users. Current: ${staffCount}`,
          );
        }
      }
    }

    const existingUser = await User.findOne({
      tenantId,
      phoneNumber: data.phoneNumber,
      email: data.email,
    });

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

  async updateStaff({ tenantId, staffId, data, userRole }) {
    this.checktenantId(tenantId);
    data = this.normalizeWorkplaceUpdateData(data || {});

    const currentStaff = await User.findOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
    );

    if (!currentStaff) {
      throw new Error("Invalid staff ID");
    }

    if (data.role) {
      data.role = this.validateStaffRole(data.role);
    }

    if (Object.hasOwn(data, "password")) {
      throw new Error("Password cannot be updated through this endpoint");
    }

    if (Object.hasOwn(data, "phoneNumber")) {
      throw new Error("Phone number cannot be updated through this endpoint");
    }

    if (Object.hasOwn(data, "status")) {
      throw new Error("Status cannot be updated through this endpoint");
    }

    const nextRole = data.role || currentStaff.role;
    const nextBranchId =
      data.branchId !== undefined ? data.branchId : currentStaff.branchId;
    const nextWarehouseId =
      data.warehouseId !== undefined
        ? data.warehouseId
        : currentStaff.warehouseId;

    if (validateRoleHierarchy(userRole, nextRole) === false)
      throw new Error(
        `Your role (${userRole}) do not have permission to update staff with role ${nextRole}`,
      );

    await this.checkRoleAndBranchValidity(
      nextRole,
      nextBranchId,
      nextWarehouseId,
      tenantId,
      staffId,
    );

    await this.checkStaffUniqueness({
      tenantId,
      email: data.email,
      staffIdToExclude: staffId,
    });

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

  async createStaffAccount({ tenantId, staffId, data }) {
    this.checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    const passwordCombo = this.validatePasswordCombo(data);

    const staff = await User.findOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
    );

    if (!staff) {
      throw new Error("Staff not found");
    }

    if (staff.status === "ACTIVE" && staff.password) {
      throw new Error("Staff account already exists");
    }

    staff.password = passwordCombo.newPassword;
    staff.status = "ACTIVE";
    await staff.save();

    const createdAccount = await this.getStaffAccountResponse(staff._id);

    return {
      message: "Staff account created successfully",
      data: createdAccount,
    };
  }

  async updateStaffAccountPassword({ tenantId, staffId, data }) {
    this.checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    const passwordCombo = this.validatePasswordCombo(data);

    const staff = await User.findOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
    );

    if (!staff) {
      throw new Error("Staff not found");
    }

    if (staff.status !== "ACTIVE" || !staff.password) {
      throw new Error("Staff account is not active");
    }

    staff.password = passwordCombo.newPassword;
    await staff.save();

    const updatedAccount = await this.getStaffAccountResponse(staff._id);

    return {
      message: "Staff account password updated successfully",
      data: updatedAccount,
    };
  }

  async deactivateStaffAccount({ tenantId, staffId }) {
    this.checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    const staff = await User.findOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
    );

    if (!staff) {
      throw new Error("Staff not found");
    }

    staff.password = undefined;
    staff.status = "INACTIVE";
    await staff.save();

    const deactivatedAccount = await this.getStaffAccountResponse(staff._id);

    return {
      message: "Staff account deactivated successfully",
      data: {
        id: deactivatedAccount._id,
        status: deactivatedAccount.status,
      },
    };
  }

  async deleteStaff({ tenantId, staffId }) {
    this.checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    const staff = await User.findOne(
      this.getStaffFilter(tenantId, { _id: staffId }),
    );

    if (!staff) {
      throw new Error("Staff not found");
    }

    staff.password = undefined;
    staff.status = "DELETED";
    await staff.save();

    const deletedAccount = await this.getStaffAccountResponse(staff._id);

    return {
      message: "Staff deleted successfully",
      data: {
        id: deletedAccount._id,
        status: deletedAccount.status,
      },
    };
  }

  getAvailableStaffRoles(userRole) {
    return STAFF_ROLES.filter((role) =>
      validateRoleHierarchy(userRole, role),
    ).map((role) => ({
      value: role,
      label: role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    }));
  }
}

module.exports = new StaffService();

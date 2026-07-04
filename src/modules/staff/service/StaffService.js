const { User, Branch, Warehouse } = require("../../../models");
const BaseService = require("../../../common/services/baseService");
const { STAFF_ROLES } = require("../../../constants/role");
const { createStaffDTO, updateStaffDTO } = require("../dto/StaffDTO");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");
const {
  buildKeywordFilter,
  buildStatusFilter,
  checktenantId,
  getAvailableStaffRoles,
  getStaffFilter,
  normalizeWorkplaceUpdateData,
  validatePasswordCombo,
  validateManagerUpdateRestrictions,
  validateSingleWorkplaceAssignment,
  validateStaffRole,
  replaceBranchManagerBeforeRemove,
  replaceWarehouseManagerBeforeRemove,
} = require("./StaffHelperFunctions");

class StaffService extends BaseService {
  constructor() {
    super(User);
  }

  async getStaffAccountResponse(staffId, session = null) {
    let query = User.findById(staffId)
      .select("-password")
      .populate("branchId")
      .populate("warehouseId");
    if (session) {
      query = query.session(session);
    }

    return await query.lean();
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

  async getStaffWorkplace({ tenantId, userId, staffId }) {
    checktenantId(tenantId);

    const staff = await User.findOne(
      getStaffFilter(tenantId, userId, { _id: staffId }),
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
    validateSingleWorkplaceAssignment(role, branchId, warehouseId);

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
      const phoneFilter = { phoneNumber };

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
    checktenantId(tenantId);
    data = normalizeWorkplaceUpdateData(data || {});
    data.role = validateStaffRole(data.role, { required: true });

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
    userId,
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
    checktenantId(tenantId);

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

    const normalizedRole = validateStaffRole(role);
    const roleFilter = normalizedRole ? { role: normalizedRole } : {};
    const statusFilter = buildStatusFilter(status);
    const keywordFilter = buildKeywordFilter(keyword);
    const staffFilter = getStaffFilter(tenantId, userId, {
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
      pagination: {
        total,
        page: pagination.page,
        recordPerPage: pagination.recordPerPage,
        totalPages: Math.ceil(total / pagination.recordPerPage),
      },
      data,
    };
  }

  async getStaffById({ tenantId, userId, staffId }) {
    checktenantId(tenantId);
    return await this.findOne(
      getStaffFilter(tenantId, userId, { _id: staffId }),
      {
        select: "-password",
        populate: ["branchId", "warehouseId"],
      },
    );
  }

  async updateStaff({ tenantId, userId, staffId, data, userRole }) {
    checktenantId(tenantId);
    data = normalizeWorkplaceUpdateData(data || {});

    const currentStaff = await User.findOne(
      getStaffFilter(tenantId, userId, { _id: staffId }),
    );

    if (!currentStaff) {
      throw new Error("Invalid staff ID");
    }

    if (data.role) {
      data.role = validateStaffRole(data.role);
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

    validateManagerUpdateRestrictions({
      currentStaff,
      nextRole,
      nextBranchId,
      nextWarehouseId,
    });

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
      getStaffFilter(tenantId, userId, { _id: staffId }),
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

  async createStaffAccount({ tenantId, userId, staffId, data }) {
    checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    const passwordCombo = validatePasswordCombo(data);

    const staff = await User.findOne(
      getStaffFilter(tenantId, userId, { _id: staffId }),
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

  async updateStaffAccountPassword({ tenantId, userId, staffId, data }) {
    checktenantId(tenantId);
    await this.checkStaffId(staffId, tenantId);

    const passwordCombo = validatePasswordCombo(data);

    const staff = await User.findOne(
      getStaffFilter(tenantId, userId, { _id: staffId }),
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

  async deactivateStaffAccount({
    tenantId,
    userId,
    userRole,
    staffId,
    replacementManagerId,
  }) {
    const session = await User.startSession();
    try {
      checktenantId(tenantId);
      await this.checkStaffId(staffId, tenantId);

      const result = await session.withTransaction(async () => {
        const staff = await User.findOne(
          getStaffFilter(tenantId, userId, { _id: staffId }),
        ).session(session);

        if (!staff) {
          throw new Error("Staff not found");
        }
        if (
          ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"].includes(staff.role) &&
          userRole !== "TENANT_OWNER"
        ) {
          const error = new Error("Only tenant owner can replace managers");
          error.statusCode = 403;
          throw error;
        }
        if (staff.role === "BRANCH_MANAGER") {
          await replaceBranchManagerBeforeRemove({
            tenantId,
            targetManager: staff,
            replacementManagerId,
            session,
          });
        }
        if (staff.role === "WAREHOUSE_MANAGER") {
          await replaceWarehouseManagerBeforeRemove({
            tenantId,
            targetManager: staff,
            replacementManagerId,
            session,
          });
        }

        staff.password = undefined;
        staff.status = "INACTIVE";
        staff.role = ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"].includes(
          staff.role,
        )
          ? "STAFF"
          : staff.role;
        await staff.save({ session });

        const deactivatedAccount = await this.getStaffAccountResponse(
          staff._id,
          session,
        );

        return {
          message: "Staff account deactivated successfully",
          data: {
            id: deactivatedAccount._id,
            status: deactivatedAccount.status,
          },
        };
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  async deleteStaff({
    tenantId,
    staffId,
    replacementManagerId,
    userId,
    userRole,
  }) {
    const session = await User.startSession();
    try {
      checktenantId(tenantId);
      await this.checkStaffId(staffId, tenantId);

      const result = await session.withTransaction(async () => {
        const staff = await User.findOne(
          getStaffFilter(tenantId, userId, { _id: staffId }),
        ).session(session);

        if (!staff) {
          throw new Error("Staff not found");
        }
        if (
          ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"].includes(staff.role) &&
          userRole !== "TENANT_OWNER"
        ) {
          const error = new Error("Only tenant owner can replace managers");
          error.statusCode = 403;
          throw error;
        }
        if (staff.role === "BRANCH_MANAGER") {
          await replaceBranchManagerBeforeRemove({
            tenantId,
            targetManager: staff,
            replacementManagerId,
            session,
          });
        }
        if (staff.role === "WAREHOUSE_MANAGER") {
          await replaceWarehouseManagerBeforeRemove({
            tenantId,
            targetManager: staff,
            replacementManagerId,
            session,
          });
        }
        staff.password = undefined;
        staff.status = "DELETED";
        staff.role = ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"].includes(
          staff.role,
        )
          ? "STAFF"
          : staff.role;
        await staff.save({ session });

        const deletedAccount = await this.getStaffAccountResponse(
          staff._id,
          session,
        );

        return {
          message: "Staff deleted successfully",
          data: {
            id: deletedAccount._id,
            status: deletedAccount.status,
          },
        };
      });
      return result;
    } finally {
      session.endSession();
    }
  }

  getAvailableStaffRoles(userRole) {
    return getAvailableStaffRoles(userRole);
  }
}

module.exports = new StaffService();

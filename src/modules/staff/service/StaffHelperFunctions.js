const { STAFF_ROLES } = require("../../../constants/role");
const { createStaffAccountDTO } = require("../dto/StaffDTO");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");
const { User } = require("../../../models");

function getStaffFilter(tenantId, userId, extra = {}) {
  return {
    tenantId,
    _id: { $ne: userId },
    role: { $in: STAFF_ROLES },
    status: { $ne: "DELETED" },
    ...extra,
  };
}

function validatePasswordCombo(data) {
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

function normalizeStaffRole(role) {
  if (!role || typeof role !== "string") {
    return null;
  }

  return role.trim().toUpperCase();
}

function validateStaffRole(role, { required = false } = {}) {
  const normalizedRole = normalizeStaffRole(role);

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

function checktenantId(tenantId) {
  if (!tenantId || tenantId === null || tenantId === undefined) {
    throw new Error("Tenant ID is required");
  }
}

function buildKeywordFilter(keyword) {
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

function buildStatusFilter(status) {
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

function validateSingleWorkplaceAssignment(role, branchId, warehouseId) {
  if (branchId && warehouseId) {
    throw new Error("Staff can only be assigned to one branch or one warehouse");
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

function normalizeWorkplaceUpdateData(data) {
  if (data.branchId !== undefined && data.warehouseId === undefined) {
    data.warehouseId = null;
  }

  if (data.warehouseId !== undefined && data.branchId === undefined) {
    data.branchId = null;
  }

  return data;
}

function getAvailableStaffRoles(userRole) {
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


/**
 * Kiểm tra xem hàm update có đang đc sử dụng để 
 * update ROLE hoặc WarehouseId/BranchId
 * của Manager hay không. Nếu có thì ném lỗi
 * vì việc thay đổi ROLE hoặc nơi làm việc của Manager 
 * phải thông qua API phân công quản lý
 * 
*/

function validateManagerUpdateRestrictions({
  currentStaff,
  nextRole,
  nextBranchId,
  nextWarehouseId,
}) {
  const managerRoles = ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"];
  const currentRole = currentStaff.role;
  const currentBranchId = currentStaff.branchId?.toString() || null;
  const currentWarehouseId = currentStaff.warehouseId?.toString() || null;
  const targetBranchId = nextBranchId?.toString() || null; // BranchId để chuyển sang
  const targetWarehouseId = nextWarehouseId?.toString() || null; // WarehouseId để chuyển sang

  //Check xem có đang đụng đến Manager hay k
  const touchesManagerRole =
    managerRoles.includes(currentRole) || managerRoles.includes(nextRole);

    // Nếu không đụng đến Manager(đang update STAFF) thì return luôn
  if (!touchesManagerRole) {
    return;
  }
 
  /**
   * Nếu đang update Manager thì check xem 
   * có đang update ROLE hoặc nơi làm việc hay không
   */
  const unchangedBranchManager =
    currentRole === "BRANCH_MANAGER" &&
    nextRole === "BRANCH_MANAGER" &&
    currentBranchId === targetBranchId &&
    !targetWarehouseId;

  const unchangedWarehouseManager =
    currentRole === "WAREHOUSE_MANAGER" &&
    nextRole === "WAREHOUSE_MANAGER" &&
    currentWarehouseId === targetWarehouseId &&
    !targetBranchId;

  // Nếu đang update Manager nhưng không đụng đến ROLE hoặc nơi làm việc thì return luôn
  if (unchangedBranchManager || unchangedWarehouseManager) {
    return;
  }

  // Nếu đang update Manager và đụng đến ROLE hoặc nơi làm việc thì ném lỗi
  const error = new Error(
    "Vui lòng dùng API phân công quản lý để thay đổi vai trò hoặc nơi làm việc của quản lý",
  );
  error.statusCode = 400;
  throw error;
}

const isActiveBranchManager = (staff) => {
  return staff.role === "BRANCH_MANAGER" && staff.branchId;
};

const isActiveWarehouseManager = (staff) => {
  return staff.role === "WAREHOUSE_MANAGER" && staff.warehouseId;
};

const validateReplacementManagerId = (targetManager, replacementManagerId) => {
  if (!replacementManagerId) {
    const error = new Error("Thiếu thông tin nhân viên thay thế");
    error.statusCode = 400;
    throw error;
  }

  if (String(replacementManagerId) === String(targetManager._id)) {
    const error = new Error("Quản lý thay thế phải là một nhân viên khác");
    error.statusCode = 400;
    throw error;
  }
};

const replaceBranchManagerBeforeRemove = async ({
  tenantId,
  targetManager,
  replacementManagerId,
  session,
}) => {
  if (!isActiveBranchManager(targetManager)) {
    const error = new Error(
      "Không phải là Branch Manager đang hoạt động, không cần thay thế",
    );
    error.statusCode = 400;
    throw error;
  }

  validateReplacementManagerId(targetManager, replacementManagerId);

  const replacementStaff = await User.findOne({
    _id: replacementManagerId,
    tenantId,
    role: "STAFF",
    branchId: targetManager.branchId,
    status: "ACTIVE",
  }).session(session);

  if (!replacementStaff) {
    const error = new Error(
      "Nhân viên thay thế không tồn tại hoặc không phải là nhân viên đang hoạt động trong chi nhánh của quản lý hiện tại",
    );
    error.statusCode = 400;
    throw error;
  }

  replacementStaff.role = "BRANCH_MANAGER";
  await replacementStaff.save({ session });
};

const replaceWarehouseManagerBeforeRemove = async ({
  tenantId,
  targetManager,
  replacementManagerId,
  session,
}) => {
  if (!isActiveWarehouseManager(targetManager)) {
    const error = new Error(
      "Không phải là Warehouse Manager đang hoạt động, không cần thay thế",
    );
    error.statusCode = 400;
    throw error;
  }

  validateReplacementManagerId(targetManager, replacementManagerId);

  const replacementStaff = await User.findOne({
    _id: replacementManagerId,
    tenantId,
    role: "STAFF",
    status: "ACTIVE",
  }).session(session);

  if (!replacementStaff) {
    const error = new Error(
      "Nhân viên thay thế không tồn tại hoặc không phải là nhân viên đang hoạt động trong tenant hiện tại",
    );
    error.statusCode = 400;
    throw error;
  }

  replacementStaff.role = "WAREHOUSE_MANAGER";
  replacementStaff.warehouseId = targetManager.warehouseId;
  replacementStaff.branchId = null;
  await replacementStaff.save({ session });
};

module.exports = {
  buildKeywordFilter,
  buildStatusFilter,
  checktenantId,
  getAvailableStaffRoles,
  getStaffFilter,
  normalizeStaffRole,
  normalizeWorkplaceUpdateData,
  validatePasswordCombo,
  validateManagerUpdateRestrictions,
  validateSingleWorkplaceAssignment,
  validateStaffRole,
  replaceBranchManagerBeforeRemove,
  replaceWarehouseManagerBeforeRemove,
};

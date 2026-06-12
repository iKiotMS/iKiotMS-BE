const permissions = require("../config/permissions.json");

const hasPermission = (userRole, module, action) => {
  if (!permissions[userRole]) {
    return false;
  }

  const rolePermissions = permissions[userRole];
  if (!rolePermissions[module]) {
    return false;
  }

  return rolePermissions[module].includes(action);
};

const validateRoleHierarchy = (assignerRole, assigneeRole) => {
  const hierarchy = {
    SUPER_ADMIN: [
      "SUPER_ADMIN",
      "TENANT_OWNER",
      "BRANCH_MANAGER",
      "WAREHOUSE_MANAGER",
      "STAFF",
      "CUSTOMER",
    ],
    TENANT_OWNER: [
      "BRANCH_MANAGER",
      "WAREHOUSE_MANAGER",
      "STAFF",
      "CUSTOMER",
    ],
    BRANCH_MANAGER: ["STAFF"],
    WAREHOUSE_MANAGER: ["STAFF"],
    STAFF: [],
    CUSTOMER: [],
  };

  if (!hierarchy[assignerRole]) {
    return false;
  }

  return hierarchy[assignerRole].includes(assigneeRole);
};

module.exports = {
  hasPermission,
  validateRoleHierarchy,
};

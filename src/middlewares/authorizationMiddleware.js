const { hasPermission } = require("../utils/permissionChecker");
const ManagedScheduleAccessService = require("../services/managedScheduleAccessService");

const authorize = (module, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user found",
      });
    }

    // This context must only come from a fresh database check, never from JWT claims.
    delete req.user.managedScheduleAccess;

    const userRole = req.user.role;

    const actions = Array.isArray(action) ? action : [action];
    const isAllowedByRole = actions.some((allowedAction) =>
      hasPermission(userRole, module, allowedAction),
    );

    try {
      const needsManagedScheduleLookup = actions.some(
        (allowedAction) =>
          !hasPermission(userRole, module, allowedAction) &&
          ManagedScheduleAccessService.supports(module, allowedAction),
      );

      if (needsManagedScheduleLookup) {
        const managedScheduleAccess =
          await ManagedScheduleAccessService.resolve(
            req.user,
            module,
            actions,
          );

        if (managedScheduleAccess) {
          req.user.managedScheduleAccess = managedScheduleAccess;
          return next();
        }
      }
    } catch (error) {
      if (isAllowedByRole) return next();

      console.error("Managed schedule authorization error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to verify managed schedule access",
      });
    }

    if (!isAllowedByRole) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You don't have permission to ${actions.join(" or ")} ${module}`,
      });
    }

    return next();
  };
};

module.exports = { authorize };

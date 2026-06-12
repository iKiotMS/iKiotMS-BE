const { hasPermission } = require("../utils/permissionChecker");

const authorize = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user found",
      });
    }

    const userRole = req.user.role;

    const actions = Array.isArray(action) ? action : [action];
    const isAllowed = actions.some((allowedAction) =>
      hasPermission(userRole, module, allowedAction),
    );

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You don't have permission to ${actions.join(" or ")} ${module}`,
      });
    }

    next();
  };
};

module.exports = { authorize };

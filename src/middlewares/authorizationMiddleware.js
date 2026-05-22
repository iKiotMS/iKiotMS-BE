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

    if (!hasPermission(userRole, module, action)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You don't have permission to ${action} ${module}`,
      });
    }

    next();
  };
};

module.exports = { authorize };

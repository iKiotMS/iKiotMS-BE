const { verifyJwt } = require("../../middlewares/authMiddleware");
const aiController = require("./controller/ai.controller");

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user found",
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to roles: ${roles.join(", ")}`,
      });
    }
    next();
  };
};

const registerAIModule = (app) => {
  // TENANT_OWNER and BRANCH_MANAGER are allowed to use AI features
  app.post("/ai/chat", verifyJwt, authorizeRoles("TENANT_OWNER", "BRANCH_MANAGER"), aiController.chat);
  app.get("/ai/conversations", verifyJwt, authorizeRoles("TENANT_OWNER", "BRANCH_MANAGER"), aiController.listConversations);
  app.get("/ai/conversations/:id", verifyJwt, authorizeRoles("TENANT_OWNER", "BRANCH_MANAGER"), aiController.getConversationDetail);
  app.delete("/ai/conversations/:id", verifyJwt, authorizeRoles("TENANT_OWNER", "BRANCH_MANAGER"), aiController.deleteConversation);
  app.put("/ai/conversations/:id", verifyJwt, authorizeRoles("TENANT_OWNER", "BRANCH_MANAGER"), aiController.renameConversation);
};

module.exports = { registerAIModule };

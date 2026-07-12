const AuditController = require("./controller/AuditController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

const registerAuditModule = (app) => {
  app.get("/admin/audit-logs", verifyJwt, AuditController.getAuditLogs.bind(AuditController));
  console.log("✓ Audit module registered");
};

module.exports = { registerAuditModule };

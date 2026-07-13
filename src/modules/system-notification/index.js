const SystemNotificationController = require("./controller/SystemNotificationController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

const registerSystemNotificationModule = (app) => {
  // Composed Announcements (email based)
  app.post("/admin/notifications", verifyJwt, SystemNotificationController.composeNotification.bind(SystemNotificationController));
  app.get("/admin/notifications", verifyJwt, SystemNotificationController.getAnnouncements.bind(SystemNotificationController));

  // System Events logs (WebSocket based)
  app.get("/admin/system-notifications", verifyJwt, SystemNotificationController.getSystemNotifications.bind(SystemNotificationController));
  app.patch("/admin/system-notifications/:id/read", verifyJwt, SystemNotificationController.markAsRead.bind(SystemNotificationController));
  app.patch("/admin/system-notifications/mark-all-read", verifyJwt, SystemNotificationController.markAllAsRead.bind(SystemNotificationController));
  app.delete("/admin/system-notifications", verifyJwt, SystemNotificationController.deleteAllNotifications.bind(SystemNotificationController));
  app.delete("/admin/system-notifications/:id", verifyJwt, SystemNotificationController.deleteNotification.bind(SystemNotificationController));

  console.log("✓ System Notification module registered");
};

module.exports = { registerSystemNotificationModule };

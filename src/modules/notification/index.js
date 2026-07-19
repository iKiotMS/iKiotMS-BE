const NotificationController = require("./controller/NotificationController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the caller's notification inbox
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Inbox page plus unreadCount
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Number of unread notifications (for the badge)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark every notification in the caller's inbox as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marked as read
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark one notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Marked as read
 *       404:
 *         description: Not found in the caller's inbox
 * /notifications/device-token:
 *   post:
 *     tags: [Notifications]
 *     summary: Register the caller's FCM device token for push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: FCM registration token from the browser }
 *               userAgent: { type: string }
 *     responses:
 *       200:
 *         description: Device registered
 *       400:
 *         description: Missing device token
 *   delete:
 *     tags: [Notifications]
 *     summary: Remove a device token (call on logout)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Device removed
 * /notifications/test:
 *   post:
 *     tags: [Notifications]
 *     summary: Send a test push to the caller's own devices (non-production only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test push dispatched
 *       404:
 *         description: Disabled in production
 */
function registerNotificationModule(app) {
  // These routes are self-scoped — a user only ever reads their own inbox, or
  // registers/removes their own device — so verifyJwt is the whole guard. No
  // permissions.json entry is needed, unlike the tenant-data modules.
  app.get(
    "/notifications",
    verifyJwt,
    NotificationController.getInbox.bind(NotificationController),
  );

  app.get(
    "/notifications/unread-count",
    verifyJwt,
    NotificationController.getUnreadCount.bind(NotificationController),
  );

  // Đăng ký trước "/:id/read" để "read-all" không bị bắt nhầm thành một :id.
  app.patch(
    "/notifications/read-all",
    verifyJwt,
    NotificationController.markAllAsRead.bind(NotificationController),
  );

  app.patch(
    "/notifications/:id/read",
    verifyJwt,
    NotificationController.markAsRead.bind(NotificationController),
  );

  // Đăng ký "delete-all" trước "/:id" để không bị bắt nhầm
  app.delete(
    "/notifications",
    verifyJwt,
    NotificationController.deleteAllNotifications.bind(NotificationController),
  );

  // "device-token" cũng phải đứng TRƯỚC "/:id", nếu không "device-token" sẽ bị
  // bắt nhầm thành :id → deleteNotification cast "device-token" sang ObjectId
  // và ném lỗi 500.
  app.delete(
    "/notifications/device-token",
    verifyJwt,
    NotificationController.removeDeviceToken.bind(NotificationController),
  );

  app.delete(
    "/notifications/:id",
    verifyJwt,
    NotificationController.deleteNotification.bind(NotificationController),
  );

  app.post(
    "/notifications/device-token",
    verifyJwt,
    NotificationController.registerDeviceToken.bind(NotificationController),
  );

  app.post(
    "/notifications/test",
    verifyJwt,
    NotificationController.sendTest.bind(NotificationController),
  );
}

module.exports = { registerNotificationModule };

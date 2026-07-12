const { User, Notification } = require("../../../models");
const { sendToUsers } = require("../../../services/pushService");

class NotificationService {
  buildInboxFilter(user) {
    return {
      tenantId: user.tenantId,
      $or: [{ recipientId: user.userId }, { recipientId: null }],
    };
  }

  async getInbox(user, { page = 1, limit = 20 } = {}) {
    const filter = this.buildInboxFilter(user);
    const skip = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);

    return {
      data,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(user) {
    const count = await Notification.countDocuments({
      ...this.buildInboxFilter(user),
      isRead: false,
    });

    return { unreadCount: count };
  }

  async markAsRead(user, notificationId) {
    // Lọc kèm bộ lọc hộp thư để không ai đánh dấu đọc noti của người khác.
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, ...this.buildInboxFilter(user) },
      { $set: { isRead: true } },
      { new: true },
    ).lean();

    if (!updated) {
      throw new Error("Notification not found");
    }

    return updated;
  }

  async markAllAsRead(user) {
    const result = await Notification.updateMany(
      { ...this.buildInboxFilter(user), isRead: false },
      { $set: { isRead: true } },
    );

    return { updated: result.modifiedCount };
  }

  async deleteNotification(user, notificationId) {
    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      ...this.buildInboxFilter(user),
    }).lean();

    if (!deleted) {
      throw new Error("Notification not found");
    }

    return deleted;
  }

  async deleteAllNotifications(user) {
    const result = await Notification.deleteMany(this.buildInboxFilter(user));
    return { deleted: result.deletedCount };
  }

  /**
   * Attach an FCM device token to a user.
   *
   * Firebase hands the same browser the same token across sessions, and a token
   * can migrate between accounts on a shared machine. So: strip the token from
   * whoever held it before, then add it to this user. That keeps the token
   * unique across users and stops the previous account receiving this device's
   * pushes after a logout/login swap.
   */
  async registerDeviceToken(userId, { token, userAgent }) {
    // Detach the token from every user that currently holds it (including this
    // one — that makes the re-register case idempotent rather than duplicating).
    await User.updateMany(
      { "fcmTokens.token": token },
      { $pull: { fcmTokens: { token } } },
    );

    const result = await User.updateOne(
      { _id: userId },
      { $push: { fcmTokens: { token, userAgent, createdAt: new Date() } } },
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    return { registered: true };
  }

  async removeDeviceToken(userId, token) {
    await User.updateOne(
      { _id: userId },
      { $pull: { fcmTokens: { token } } },
    );

    return { removed: true };
  }

  /**
   * Dev helper: push to the caller's own devices so the whole chain
   * (browser token → DB → FCM → service worker) can be verified end to end.
   */
  async sendTestToSelf(userId) {
    return sendToUsers([userId], {
      title: "iKiot",
      body: "Thông báo thử nghiệm — nếu bạn thấy dòng này thì FCM đã hoạt động.",
      data: { type: "TEST" },
    });
  }
}

module.exports = new NotificationService();

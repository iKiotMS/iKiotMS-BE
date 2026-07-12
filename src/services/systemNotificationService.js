const Notification = require("../models/Notification");
const { emitToRoom } = require("./socketService");

const createSystemNotification = async ({ title, description, type, referenceId }) => {
  try {
    const notification = await Notification.create({
      title,
      description,
      type,
      referenceId,
      isRead: false,
    });

    // Broadcast in real-time to administrative users
    emitToRoom("admin", "system-notification", notification);
    return notification;
  } catch (error) {
    console.error("Failed to create system notification:", error);
  }
};

module.exports = { createSystemNotification };

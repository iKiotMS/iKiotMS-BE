const Notification = require("../../../models/Notification");
const { User, Tenant } = require("../../../models");
const { sendSystemNotificationEmail } = require("../../../services/emailService");

class SystemNotificationController {
  // Composed by admins (ANNOUNCEMENT) -> Sent via Email
  async composeNotification(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const { title, description, category, targetType, targetTenants } = req.body;

      if (!title || !description || !category || !targetType) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      // Save announcement compose history
      const announcement = await Notification.create({
        title,
        description,
        type: "ANNOUNCEMENT",
        category,
        targetType,
        targetTenants: targetType === "SELECTION" ? targetTenants : [],
        createdBy: req.user.userId,
      });

      // Find targeted emails
      let users = [];
      if (targetType === "ALL") {
        users = await User.find({ role: "TENANT_OWNER", status: "ACTIVE" }).select("email profile").lean();
      } else if (targetType === "SELECTION" && Array.isArray(targetTenants)) {
        users = await User.find({
          role: "TENANT_OWNER",
          status: "ACTIVE",
          tenantId: { $in: targetTenants },
        }).select("email profile").lean();
      }

      // Send emails asynchronously (fire and forget so UI doesn't hang)
      const recipientEmails = users.map((u) => u.email).filter(Boolean);
      recipientEmails.forEach((email) => {
        sendSystemNotificationEmail(email, {
          title,
          description,
          category,
        }).catch((err) => {
          console.error(`Failed to send announcement email to ${email}:`, err);
        });
      });

      res.status(201).json({
        success: true,
        message: `Thông báo đã được xếp lịch gửi tới ${recipientEmails.length} chủ cửa hàng.`,
        data: announcement,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get announcements compose history
  async getAnnouncements(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const list = await Notification.find({ type: "ANNOUNCEMENT" })
        .populate("targetTenants", "name")
        .populate("createdBy", "email profile")
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ success: true, data: list });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get real-time system notifications (SYSTEM_TRANSACTION, SYSTEM_TENANT_CREATED, SYSTEM_TICKET_CREATED)
  async getSystemNotifications(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const list = await Notification.find({
        type: { $in: ["SYSTEM_TRANSACTION", "SYSTEM_TENANT_CREATED", "SYSTEM_TICKET_CREATED", "SYSTEM_TENANT_BANK_UPDATED"] },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.status(200).json({ success: true, data: list });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Mark system notification as read
  async markAsRead(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const { id } = req.params;
      const updated = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });

      if (!updated) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Mark all system notifications as read
  async markAllAsRead(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      await Notification.updateMany(
        {
          type: { $in: ["SYSTEM_TRANSACTION", "SYSTEM_TENANT_CREATED", "SYSTEM_TICKET_CREATED", "SYSTEM_TENANT_BANK_UPDATED"] },
          isRead: false,
        },
        { isRead: true }
      );

      res.status(200).json({ success: true, message: "Marked all as read" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Delete a single system notification
  async deleteNotification(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const { id } = req.params;
      const deleted = await Notification.findOneAndDelete({
        _id: id,
        type: { $in: ["SYSTEM_TRANSACTION", "SYSTEM_TENANT_CREATED", "SYSTEM_TICKET_CREATED", "SYSTEM_TENANT_BANK_UPDATED"] },
      });

      if (!deleted) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }

      res.status(200).json({ success: true, message: "Deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Delete all system notifications
  async deleteAllNotifications(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const result = await Notification.deleteMany({
        type: { $in: ["SYSTEM_TRANSACTION", "SYSTEM_TENANT_CREATED", "SYSTEM_TICKET_CREATED", "SYSTEM_TENANT_BANK_UPDATED"] },
      });

      res.status(200).json({ success: true, message: "Deleted all", deleted: result.deletedCount });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new SystemNotificationController();

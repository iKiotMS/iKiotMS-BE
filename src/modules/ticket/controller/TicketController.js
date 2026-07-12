const Ticket = require("../../../models/Ticket");
const Tenant = require("../../../models/Tenant");
const { createSystemNotification } = require("../../../services/systemNotificationService");
const { emitToRoom } = require("../../../services/socketService");
const NotificationService = require("../../../services/notificationService");

class TicketController {
  // Tenant creates a ticket
  async create(req, res) {
    try {
      const { title, description, priority } = req.body;
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(403).json({ success: false, message: "Tenant context required" });
      }

      if (!title || !description) {
        return res.status(400).json({ success: false, message: "Title and description are required" });
      }

      const tenant = await Tenant.findById(tenantId).lean();
      const tenantName = tenant ? tenant.name : "Unknown Store";

      const ticketId = `TK-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

      const namePart = req.user.profile?.firstName
        ? `${req.user.profile.firstName} ${req.user.profile.lastName || ""}`.trim()
        : req.user.email || req.user.phoneNumber || "User";

      const ticket = await Ticket.create({
        ticketId,
        tenantId,
        tenantName,
        userId: req.user.userId,
        title,
        description,
        priority: priority || "MEDIUM",
        status: "OPEN",
        messages: [
          {
            senderId: req.user.userId,
            senderName: namePart,
            senderRole: req.user.role,
            message: description,
          },
        ],
      });

      // Save system notification for Admin UI
      await createSystemNotification({
        title: "Yêu cầu hỗ trợ mới",
        description: `Cửa hàng "${tenantName}" đã gửi yêu cầu hỗ trợ mã ${ticketId}: "${title}"`,
        type: "SYSTEM_TICKET_CREATED",
        referenceId: ticket._id.toString(),
      });

      // Broadcast real-time ticket update
      emitToRoom("admin", "ticket-update", ticket);

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Tenant lists their own tickets
  async listMyTickets(req, res) {
    try {
      const tenantId = req.user.tenantId;
      if (!tenantId) {
        return res.status(403).json({ success: false, message: "Tenant context required" });
      }

      const tickets = await Ticket.find({ tenantId }).sort({ updatedAt: -1 }).lean();
      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Tenant replies to their ticket
  async replyMyTicket(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const tenantId = req.user.tenantId;

      if (!message) {
        return res.status(400).json({ success: false, message: "Message is required" });
      }

      const ticket = await Ticket.findOne({ _id: id, tenantId });
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Ticket not found" });
      }

      if (ticket.status === "CLOSED") {
        return res.status(400).json({ success: false, message: "Cannot reply to a closed ticket" });
      }

      const namePart = req.user.profile?.firstName
        ? `${req.user.profile.firstName} ${req.user.profile.lastName || ""}`.trim()
        : req.user.email || req.user.phoneNumber || "User";

      ticket.messages.push({
        senderId: req.user.userId,
        senderName: namePart,
        senderRole: req.user.role,
        message,
      });

      ticket.status = "OPEN"; // Reset status to OPEN when tenant replies
      await ticket.save();

      // Emit to admin room
      emitToRoom("admin", "ticket-update", ticket);

      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin lists all tickets
  async listAllTickets(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const tickets = await Ticket.find().sort({ updatedAt: -1 }).lean();
      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin/Tenant get detail
  async getTicketDetail(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({ success: false, message: "Ticket not found" });
      }

      // If tenant, verify ownership
      if (req.user.role !== "SUPER_ADMIN" && ticket.tenantId.toString() !== req.user.tenantId.toString()) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin replies to a ticket
  async replyTicket(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const { id } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, message: "Message is required" });
      }

      const ticket = await Ticket.findById(id);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Ticket not found" });
      }

      const namePart = req.user.profile?.firstName
        ? `${req.user.profile.firstName} ${req.user.profile.lastName || ""}`.trim()
        : req.user.email || req.user.phoneNumber || "Admin";

      ticket.messages.push({
        senderId: req.user.userId,
        senderName: namePart,
        senderRole: req.user.role,
        message,
      });

      ticket.status = "IN_PROGRESS";
      await ticket.save();

      // Broadcast to both room admin and the tenant's room
      emitToRoom("admin", "ticket-update", ticket);
      emitToRoom(`tenant:${ticket.tenantId}`, "ticket-update", ticket);

      // Chủ cửa hàng đã gửi ticket rồi đóng máy chờ — push để họ biết có hồi âm.
      const owners = await NotificationService.tenantOwners(ticket.tenantId);
      await NotificationService.notify({
        tenantId: ticket.tenantId,
        recipientIds: owners,
        type: "TICKET_REPLIED",
        title: "Yêu cầu hỗ trợ đã được phản hồi",
        description: `Bộ phận hỗ trợ đã trả lời ticket ${ticket.ticketId || ""}.`.trim(),
        link: `/faqs`,
        referenceId: ticket._id,
      });

      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin closes a ticket
  async closeTicket(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const { id } = req.params;
      const ticket = await Ticket.findById(id);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Ticket not found" });
      }

      ticket.status = "CLOSED";
      await ticket.save();

      // Broadcast to both room admin and the tenant's room
      emitToRoom("admin", "ticket-update", ticket);
      emitToRoom(`tenant:${ticket.tenantId}`, "ticket-update", ticket);

      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new TicketController();

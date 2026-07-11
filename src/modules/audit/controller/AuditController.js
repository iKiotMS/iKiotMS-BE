const AuditLog = require("../../../models/AuditLog");

class AuditController {
  async getAuditLogs(req, res) {
    try {
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden: Super admin only" });
      }

      const { user, action, resource, startDate, endDate, page = 1, limit = 20 } = req.query;

      const query = {};

      if (user) {
        query.$or = [
          { userName: { $regex: user, $options: "i" } },
          { userEmail: { $regex: user, $options: "i" } },
        ];
      }

      if (action && action !== "all") {
        query.action = action.toUpperCase();
      }

      if (resource && resource !== "all") {
        query.resource = { $regex: resource, $options: "i" };
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await AuditLog.countDocuments(query);
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AuditController();

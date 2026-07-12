const auditLogger = (req, res, next) => {
  // Only log mutating methods: POST, PUT, PATCH, DELETE
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  // Avoid logging webhooks, uploads, or non-login auth requests
  const path = req.originalUrl;
  if (
    path.includes("/webhook") ||
    path.includes("/uploads") ||
    (path.includes("/auth") && !path.includes("/login"))
  ) {
    return next();
  }


  // Capture IP address eagerly (before socket may close)
  const rawIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "";
  // Normalize IPv6 loopback (::1) and IPv4-mapped IPv6 (::ffff:x.x.x.x) to plain IPv4
  const normalizeIp = (ip) => {
    if (!ip) return "127.0.0.1";
    if (ip === "::1") return "127.0.0.1";
    if (ip.startsWith("::ffff:")) return ip.slice(7);
    return ip;
  };
  const ipAddress = normalizeIp(rawIp);

  // Capture response finish to log successful operations
  res.on("finish", async () => {
    try {
      // Only log successful modifications (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Import models dynamically to avoid circular dependencies
        const { AuditLog, Tenant, User, Ticket } = require("../models");

        // User info populated by verifyJwt
        let user = req.user;
        const method = req.method;

        // If it's a login and succeeded, resolve the user from request body
        if (!user && path.includes("/login")) {
          const identifier = req.body?.phoneNumber || req.body?.email;
          if (identifier) {
            const matchedUser = await User.findOne({
              $or: [{ phoneNumber: identifier }, { email: identifier }],
            }).lean();
            if (matchedUser) {
              user = {
                userId: matchedUser._id,
                email: matchedUser.email,
                role: matchedUser.role,
                profile: matchedUser.profile,
              };
            }
          }
        }

        // Only log actions performed by SUPER_ADMIN role
        if (!user || user.role !== "SUPER_ADMIN") {
          return;
        }

        let action = "UNKNOWN";
        let resource = null;
        let details = "";

        // Resolve action
        if (method === "POST") {
          action = "CREATE";
          if (path.includes("/login")) action = "LOGIN";
        } else if (method === "PUT" || method === "PATCH") {
          action = "UPDATE";
        } else if (method === "DELETE" || path.includes("/delete")) {
          action = "DELETE";
        }

        // Resolve details & resource dynamically
        if (action === "LOGIN") {
          action = "LOGIN";
          resource = null;
          details = "Đăng nhập hệ thống thành công";
        } else if (path.includes("/subscription/upgrade/")) {
          // POST /subscription/upgrade/:tenantId
          const tenantId = req.params.tenantId || path.split("/").pop();
          let targetTenantName = `Tenant ID: ${tenantId}`;
          if (tenantId && tenantId.match(/^[0-9a-fA-F]{24}$/)) {
            const tenant = await Tenant.findById(tenantId).lean();
            if (tenant) {
              targetTenantName = `${tenant.name} - ${tenant.phoneNumber || "N/A"}`;
            }
          }
          resource = targetTenantName;
          details = `Nâng cấp gói cước subscription trực tiếp lên gói ${req.body?.planCode || "N/A"}`;
        } else if (path.includes("/tenant/") || (path.startsWith("/tenant") && method === "PUT")) {
          // PUT /tenant/:tenantId or PUT /tenant/:tenantId/sepay-key
          const segments = path.split("/");
          const tenantId = req.params.tenantId || segments[2];
          let targetTenantName = `Tenant ID: ${tenantId}`;
          if (tenantId && tenantId.match(/^[0-9a-fA-F]{24}$/)) {
            const tenant = await Tenant.findById(tenantId).lean();
            if (tenant) {
              targetTenantName = `${tenant.name} - ${tenant.phoneNumber || "N/A"}`;
            }
          }
          resource = targetTenantName;

          if (path.includes("/sepay-key")) {
            details = "Cập nhật khóa API SePay Webhook";
          } else {
            if (req.body?.status) {
              details = `Cập nhật trạng thái cửa hàng thành: ${req.body.status}`;
            } else {
              const updatedFields = Object.keys(req.body).filter(k => k !== "_id" && k !== "id");
              details = `Cập nhật thông tin cửa hàng: ${updatedFields.join(", ")}`;
            }
          }
        } else if (path.includes("/admin/notifications")) {
          // POST /admin/notifications
          if (req.body?.targetType === "ALL") {
            resource = "Tất cả cửa hàng (TENANTS)";
          } else {
            resource = `Cửa hàng được chọn (${req.body?.targetTenants?.length || 0} cửa hàng)`;
          }
          details = `Gửi email tuyên bố: "${req.body?.title || ""}" (Thể loại: ${req.body?.category || ""})`;
        } else if (path.includes("/admin/tickets/")) {
          // POST /admin/tickets/:id/reply or PATCH /admin/tickets/:id/close
          const segments = path.split("/");
          const ticketId = req.params.id || segments[3];
          let targetResource = `Ticket ID: ${ticketId}`;
          let ticketCode = "";

          if (ticketId && ticketId.match(/^[0-9a-fA-F]{24}$/)) {
            const ticket = await Ticket.findById(ticketId).lean();
            if (ticket) {
              ticketCode = ticket.ticketId;
              const tenant = await Tenant.findById(ticket.tenantId).lean();
              if (tenant) {
                targetResource = `${tenant.name} - ${tenant.phoneNumber || "N/A"}`;
              }
            }
          }

          resource = targetResource;
          if (path.includes("/reply")) {
            details = `Phản hồi yêu cầu hỗ trợ (Mã Ticket: ${ticketCode || "N/A"})`;
          } else if (path.includes("/close")) {
            details = `Đóng yêu cầu hỗ trợ (Mã Ticket: ${ticketCode || "N/A"})`;
          } else {
            details = `Thao tác trên Ticket: ${ticketCode || "N/A"}`;
          }
        } else if (path.includes("/admin/system-notifications")) {
          resource = "Thông báo hệ thống";
          if (path.includes("/mark-all-read")) {
            details = "Đánh dấu đã đọc toàn bộ thông báo hệ thống";
          } else {
            details = "Đánh dấu đã đọc một thông báo hệ thống";
          }
        } else {
          // Default fallback
          const parts = path.split("/").filter(Boolean);
          let defaultResource = "System";
          if (parts.length > 0) {
            defaultResource = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          }
          resource = defaultResource;

          const actionMap = {
            CREATE: "Tạo mới",
            UPDATE: "Cập nhật",
            DELETE: "Xóa",
          };
          const actionWord = actionMap[action] || action;
          const entityName = req.body?.name || req.body?.email || "";
          details = `${actionWord} ${resource}${entityName ? ` (${entityName})` : ""}`;
        }

        const namePart = user.profile?.firstName
          ? `${user.profile.firstName} ${user.profile.lastName || ""}`.trim()
          : user.email || user.phoneNumber || "SUPER_ADMIN";

        await AuditLog.create({
          userId: user.userId || user._id,
          userEmail: user.email,
          userName: namePart,
          userRole: user.role,
          action,
          resource,
          details,
          tenantId: user.tenantId || null,
          tenantName: user.tenantId ? undefined : "Hệ thống",
          ipAddress,
        });
      }
    } catch (error) {
      console.error("[AuditLogger Middleware Error]:", error);
    }
  });

  next();
};

module.exports = { auditLogger };

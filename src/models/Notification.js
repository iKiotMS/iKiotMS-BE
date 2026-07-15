const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Common fields
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        // --- Hộp thư của SUPER_ADMIN (đã có từ trước) ---
        "ANNOUNCEMENT",
        "SYSTEM_TRANSACTION",
        "SYSTEM_TENANT_CREATED",
        "SYSTEM_TICKET_CREATED",
        "SYSTEM_TENANT_BANK_UPDATED",

        // --- Noti cấp tenant (mới) — luôn kèm tenantId, thường kèm recipientId ---
        // Nghỉ phép
        "LEAVE_REQUEST_CREATED",
        "LEAVE_REQUEST_APPROVED",
        "LEAVE_REQUEST_REJECTED",
        "LEAVE_REQUEST_CANCELLED",
        "LEAVE_REQUEST_EXPIRED",
        // Chuyển kho
        "STOCK_MOVEMENT_CREATED",
        "STOCK_MOVEMENT_IN_TRANSIT",
        "STOCK_MOVEMENT_RECEIVED",
        "STOCK_MOVEMENT_CANCELLED",
        // Kho
        "INVENTORY_LOW_STOCK",
        // Bán hàng
        "ORDER_PAID",
        // Thanh toán / Ngân hàng
        "SEPAY_LINKED",
        // Gói dịch vụ
        "SUBSCRIPTION_ACTIVATED",
        "SUBSCRIPTION_EXPIRING",
        "SUBSCRIPTION_EXPIRED",
        // Nhân sự
        "SCHEDULE_ASSIGNED",
        "PAYSLIP_REVIEW",
        "PAYSLIP_APPROVED",
        "PAYSLIP_PAID",
        "STAFF_ACCOUNT_CREATED",
        // Hỗ trợ
        "TICKET_REPLIED",
      ],
      required: true,
    },

    // --- Người nhận ---
    // tenantId:    phạm vi. null = noti hệ thống dành cho SUPER_ADMIN.
    // recipientId: người nhận cụ thể. null + có tenantId = gửi cả tenant
    //              (ví dụ cảnh báo tồn kho cho mọi quản lý).
    // Các query hộp thư admin hiện có lọc theo whitelist `type`, nên noti cấp
    // tenant không lọt vào đó — đừng bỏ bộ lọc ấy đi.
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Deep link mở khi bấm vào thông báo, ví dụ "/leave-requests/<id>".
    link: {
      type: String,
    },

    // Announcement fields (admin -> tenant email)
    category: {
      type: String,
      enum: ["Maintenance", "New feature", "Promotion", "Security"],
      required: function () {
        return this.type === "ANNOUNCEMENT";
      },
    },
    targetType: {
      type: String,
      enum: ["ALL", "SELECTION"],
      required: function () {
        return this.type === "ANNOUNCEMENT";
      },
    },
    targetTenants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // System Notification fields (triggered by events for admin UI)
    referenceId: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Hộp thư cá nhân: "noti của tôi, mới nhất trước".
notificationSchema.index({ recipientId: 1, createdAt: -1 });
// Badge "n chưa đọc" — đếm rất thường xuyên nên tách index riêng.
notificationSchema.index({ recipientId: 1, isRead: 1 });
// Noti gửi cả tenant (recipientId = null).
notificationSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

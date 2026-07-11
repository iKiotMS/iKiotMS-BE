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
      enum: ["ANNOUNCEMENT", "SYSTEM_TRANSACTION", "SYSTEM_TENANT_CREATED", "SYSTEM_TICKET_CREATED"],
      required: true,
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

module.exports = mongoose.model("Notification", notificationSchema);

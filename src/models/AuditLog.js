const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    userEmail: String,
    userName: String,
    userRole: String,
    action: {
      type: String, // CREATE, UPDATE, DELETE, LOGIN, etc.
      required: true,
    },
    resource: {
      type: String, // Product, User, Tenant, Category, Supplier, etc.
      required: false,
    },
    details: {
      type: String,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: false,
    },
    tenantName: String,
    ipAddress: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);

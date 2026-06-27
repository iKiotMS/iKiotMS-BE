const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    leaveType: {
      type: String,
      enum:["ANNUAL", "UNPAID","SICK","OTHER"],
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum:["PENDING", "APPROVED","REJECTED","CANCELLED","EXPIRED","DELETED"],
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    reviewNote: {
      type: String,
      trim: true,
    },
    
  },
  { timestamps: true },
);

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);

const mongoose = require("mongoose");

const payrollPeriodSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "PAID", "CANCELLED"],
      default: "DRAFT",
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paidAt: Date,
  },
  { timestamps: true },
);
module.exports = mongoose.model("PayrollPeriod", payrollPeriodSchema);

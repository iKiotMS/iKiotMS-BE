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
      enum: ["DRAFT", "REVIEW", "APPROVED", "PAID", "CANCELLED"],
      default: "DRAFT",
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submittedAt: Date,
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    returnedAt: Date,
    returnReason: { type: String, trim: true },
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
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY", "SEPAY"],
    },
    // External bank/receipt code supplied by the user.
    paymentReference: { type: String, trim: true },
    paymentNote: { type: String, trim: true },
    cashFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CashFlow",
    },
    // Internal immutable code (PAYR...) copied from CashFlow for quick display.
    cashFlowReference: { type: String, trim: true },
  },
  { timestamps: true },
);

// Prevent two concurrent requests from creating the same payroll period.
payrollPeriodSchema.index(
  { tenantId: 1, periodStart: 1, periodEnd: 1, status: 1 },
  { unique: true },
);

module.exports = mongoose.model("PayrollPeriod", payrollPeriodSchema);

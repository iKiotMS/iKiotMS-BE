const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema(
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
    manageBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      trim: true,
    },
    periodStart: {
      type: Date,
    },
    periodEnd: {
      type: Date,
    },
    totalWorkedDays: {
      type: Number,
      min: [0, "Total worked days cannot be negative"],
    },
    totalWorkedHours: {
      type: Number,
      min: [0, "Total worked hours cannot be negative"],
    },
    grossSalary: {
      type: Number,
      min: [0, "Gross salary cannot be negative"],
    },
    deduction: {
      type: Number,
      min: [0, "Deduction cannot be negative"],
    },
    netSalary: {
      type: Number,
      min: [0, "Net salary cannot be negative"],
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payslip", payslipSchema);

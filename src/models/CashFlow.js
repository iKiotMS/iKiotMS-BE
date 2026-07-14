const mongoose = require("mongoose");

const cashFlowSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    flowType: {
      type: String,
      enum: ["INCOME", "EXPENSE"],
      required: [true, "Flow type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY", "SEPAY"],
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    payrollPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollPeriod",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    sepayTransactionId: {
      type: Number,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

cashFlowSchema.index({ tenantId: 1, createdAt: -1 });
cashFlowSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });

cashFlowSchema.index(
  { orderId: 1, flowType: 1 },
  { unique: true, partialFilterExpression: { orderId: { $exists: true } } },
);

// MARK_PAID is a whole-period action: one payroll period must produce exactly
// one expense row, including when two requests race at the same time.
cashFlowSchema.index(
  { payrollPeriodId: 1 },
  {
    unique: true,
    partialFilterExpression: { payrollPeriodId: { $exists: true } },
  },
);

module.exports = mongoose.model("CashFlow", cashFlowSchema);

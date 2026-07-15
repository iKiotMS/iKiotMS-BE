const mongoose = require("mongoose");

const cashDrawerSessionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch is required"],
    },
    businessDate: {
      type: String,
      required: [true, "Business date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Business date must use YYYY-MM-DD"],
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },
    openingAmount: {
      type: Number,
      required: [true, "Opening amount is required"],
      min: [0, "Opening amount cannot be negative"],
    },
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shiftLogs: [
      {
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: { type: Number, required: true, min: 0 },
        nextStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: { type: String, trim: true },
        loggedAt: { type: Date, required: true, default: Date.now },
      },
    ],
    finalLog: {
      amount: { type: Number, min: 0 },
      managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      note: { type: String, trim: true },
    },
  },
  { timestamps: true },
);

cashDrawerSessionSchema.index(
  { tenantId: 1, branchId: 1, businessDate: 1 },
  { unique: true },
);
cashDrawerSessionSchema.index(
  { tenantId: 1, branchId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } },
);

module.exports = mongoose.model("CashDrawerSession", cashDrawerSessionSchema);

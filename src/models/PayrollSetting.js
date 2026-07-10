const mongoose = require("mongoose");
const { PayrollCycle } = require("../constants/PayrollConstants");

const payrollSetting = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    cycle: {
      type: String,
      enum: PayrollCycle,
    },
    periodStartDay: {
      type: Number,
      default: 1,
    },
    approveAfterPeriodEndDays: {
      type: Number,
      default: 1,
    },
    payAfterPeriodEndDays: {
      type: Number,
      default: 1,
    },
    autoGenerate: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PayrollSetting", payrollSetting);

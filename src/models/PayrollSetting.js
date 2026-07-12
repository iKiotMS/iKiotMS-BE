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
      //ngày bắt đầu của chu kỳ trả lương
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
    standardWorkingDays: {
      type: Number,
      min: 1,
      max: 31,
      default: 26,
    },
    standardWorkingHoursPerDay: {
      type: Number,
      min: 1,
      max: 24,
      default: 8,
    },

    weekendDays: {
      type: [Number],
      default: [0],
      validate: {
        validator: (days) =>
          days.length > 0 && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: "Ngày cuối tuần phải nằm trong khoảng 0-6",
      },
    },

    lateGraceMinutes: {
      type: Number,
      min: 0,
      default: 15,
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

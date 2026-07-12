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
    payrollPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollPeriod",
    },
    manageBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paySheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaySheet",
      required: [true, "Pay sheet is required"],
    },
    status: {
      type: String,
      enum: ["DRAFT", "REVIEW", "APPROVED", "PAID", "CANCELLED"],
      default: "DRAFT",
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
    basePay: {
      type: Number,
      default: 0,
      min: [0, "Base pay cannot be negative"],
    },
    overtimePay: {
      type: Number,
      default: 0,
      min: [0, "Overtime pay cannot be negative"],
    },
    paidLeaveDays: {
      type: Number,
      default: 0,
      min: [0, "Paid leave days cannot be negative"],
    },
    unpaidLeaveDays: {
      type: Number,
      default: 0,
      min: [0, "Unpaid leave days cannot be negative"],
    },
    paidLeavePay: {
      type: Number,
      default: 0,
      min: [0, "Paid leave pay cannot be negative"],
    },
    unpaidLeaveDeduction: {
      type: Number,
      default: 0,
      min: [0, "Unpaid leave deduction cannot be negative"],
    },
    leaveLines: [
      {
        leaveRequestId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "LeaveRequest",
          required: true,
        },
        paidDays: { type: Number, default: 0, min: 0 },
        unpaidDays: { type: Number, default: 0, min: 0 },
        paidAmount: { type: Number, default: 0, min: 0 },
        deductedAmount: { type: Number, default: 0, min: 0 },
        dates: [
          {
            date: { type: Date, required: true },
            leaveType: {
              type: String,
              enum: ["PAID", "UNPAID"],
              required: true,
            },
            dayFraction: { type: Number, required: true, min: 0, max: 1 },
            amount: { type: Number, default: 0, min: 0 },
            ignoredBecauseAttended: { type: Boolean, default: false },
          },
        ],
      },
    ],
    bonus: {
      type: Number,
      default: 0,
      min: [0, "Bonus total cannot be negative"],
    },
    allowance: {
      type: Number,
      default: 0,
      min: [0, "Allowance total cannot be negative"],
    },
    allowanceLines: [
      {
        name: { type: String, required: true, trim: true },
        amountType: {
          type: String,
          enum: ["FIXED_AMOUNT", "PERCENTAGE"],
          required: true,
        },
        amountValue: { type: Number, required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    grossSalary: {
      type: Number,
      min: [0, "Gross salary cannot be negative"],
    },
    deduction: {
      type: Number,
      default: 0,
      min: [0, "Deduction cannot be negative"],
    },
    deductionLines: [
      {
        name: { type: String, required: true, trim: true },
        deductionType: {
          type: String,
          enum: ["LATE", "EARLY_LEAVE", "FIXED"],
          required: true,
        },
        conditionType: {
          type: String,
          enum: ["BY_OCCURRENCE", "BY_BLOCK", null],
          default: null,
        },
        blockMinutes: { type: Number, default: null },
        deductionValue: { type: Number, required: true, min: 0 },
        violationMinutes: { type: Number, default: 0, min: 0 },
        units: { type: Number, default: 0, min: 0 },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    netSalary: {
      type: Number,
      min: [0, "Net salary cannot be negative"],
    },
    note: {
      type: String,
      trim: true,
    },
    manualAdjustments: [
      {
        category: {
          type: String,
          enum: ["SALARY_ADVANCE", "TET_BONUS", "OTHER"],
          default: "OTHER",
        },

        name: {
          type: String,
          required: true,
          trim: true,
        },

        amount: {
          type: Number,
          required: true,
        },

        note: {
          type: String,
          trim: true,
        },

        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payslip", payslipSchema);

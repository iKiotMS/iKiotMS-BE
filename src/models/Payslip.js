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
    grossSalary: {
      type: Number,
      min: [0, "Gross salary cannot be negative"],
    },
    deduction: {
      type: Number,
      default: 0,
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

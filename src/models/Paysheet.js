const { default: mongoose } = require("mongoose");

const PaysheetSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Pay sheet name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DELETED"],
      default: "ACTIVE",
    },

    basicPay: {
      payType: {
        type: String,
        enum: ["PAY_BY_SHIFT", "STANDARD_WORKING_DAY", "FIXED"],
        required: true,
      },
      amountPerShift: Number,
      amountPerHour: Number,
      salaryPerPeriod: Number,
      standardWorkingDays: Number,

      rates: {
        holiday: { type: Number, default: 1 },
        specialHoliday: { type: Number, default: 1 },
      },
    },
    overtime: {
      normalDay: Number,
      holiday: Number,
      specialHoliday: Number,
    },
    bonuses: [
      {
        bonusType: {
          type: String,
          enum: ["EMPLOYEE_REVENUE", "MINIMUM_AVENUE_INCOME", "BRANCH_REVENUE"],
          trim: true,
          required: true,
        },
        calculationType: {
          type: String,
          enum: ["GROSS_REVENUE", "NET_REVENUE", "COLLECTED_REVENUE"],
          trim: true,
          required: true,
        },
        enable: {
          type: Boolean,
          default: false,
        },
        tiers: [
          {
            name: {
              type: String,
              trim: true,
            },
            fromValue: { type: Number },
            rewardType: {
              type: String,
              enum: ["FIXED_AMOUNT", "PERCENTAGE"],
            },
            rewardValue: { type: Number },
          },
        ],
      },
    ],

    allowances: [
      {
        name: {
          type: String,
          trim: true,
        },
        enable: { type: Boolean, default: false },
        allowancesType: {
          type: String,
          enum: ["FIXED_DAILY", "FIXED_MONTHLY"],
        },
        amountType: {
          type: String,
          enum: ["FIXED_AMOUNT", "PERCENTAGE"],
        },
        amountValue: { type: Number },
      },
    ],

    deductions: [
      {
        name: {
          type: String,
          trim: true,
          required: true, // Tương ứng: "Tên loại giảm trừ"
        },
        enable: {
          type: Boolean,
          default: false,
        },
        deductionType: {
          type: String,
          enum: ["LATE", "EARLY_LEAVE", "FIXED"], // Tương ứng radio: Đi muộn, Về sớm, Cố định
          required: true,
        },

        // ==========================================
        // NHÓM 1: Dành cho LATE (Đi muộn) và EARLY_LEAVE (Về sớm)
        // ==========================================
        conditionType: {
          type: String,
          enum: ["BY_OCCURRENCE", "BY_BLOCK", "BY_SALARY_COEFFICIENT"],
          // Tương ứng: Theo số lần, Theo block, Theo hệ số lương
        },
        blockMinutes: {
          type: Number,
          // Tương ứng input "[ 1 ] phút". Chỉ lưu giá trị nếu conditionType = 'BY_BLOCK'
        },

        // ==========================================
        // NHÓM 2: Dành cho FIXED (Cố định)
        // ==========================================
        amountType: {
          type: String,
          enum: ["FIXED_AMOUNT", "PERCENTAGE"],
          // Tương ứng: VND, % Tổng thu nhập
        },

        // ==========================================
        // TRƯỜNG DÙNG CHUNG: Giá trị giảm trừ
        // ==========================================
        deductionValue: {
          type: Number,
          // Tương ứng input: "Khoản giảm trừ".
          // Sẽ lưu số tiền VND, hoặc con số % tùy theo các điều kiện trên.
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Paysheet", PaysheetSchema);

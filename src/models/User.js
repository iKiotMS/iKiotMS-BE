const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return ["ACTIVE", "SUSPENDED"].includes(this.status);
      },
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "TENANT_OWNER",
        "BRANCH_MANAGER",
        "WAREHOUSE_MANAGER",
        "STAFF",
        "CUSTOMER",
      ],
      required: [true, "Role is required"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"],
      default: "ACTIVE",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletionReason: {
      type: String,
      trim: true,
      default: null,
    },
    lastLogin: {
      type: Date,
    },
    hireDate: {
      type: Date,
    },

    paySheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaySheet",
      default: null,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    accountNote: { type: String },
    profile: {
      firstName: String,
      lastName: String,
      avatarUrl: String,
      dob: Date,
      taxNumber: String,
      identificationId: String,
      address: String,
      gender: {
        type: String,
        enum: ["MALE", "FEMALE", "OTHER"],
      },
    },
    leaveBalance: {
      annualLeaveDays: { type: Number, default: 12, min: 0 },
      remainingDays: { type: Number, default: 12, min: 0 },
    },
    // FCM device tokens for push notifications. One user can have several
    // (nhiều trình duyệt / thiết bị). Tokens are rotated by Firebase, and go
    // stale when a user clears site data — pushService prunes the ones FCM
    // rejects as UNREGISTERED.
    fcmTokens: [
      {
        token: { type: String, required: true },
        userAgent: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Push fan-out looks users up by token; keep that lookup indexed.
userSchema.index({ "fcmTokens.token": 1 });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (!this.password) return;

  this.password = await bcryptjs.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  const bcryptjs = require("bcryptjs");
  return await bcryptjs.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

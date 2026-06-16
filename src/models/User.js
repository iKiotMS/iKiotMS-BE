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
    lastLogin: {
      type: Date,
    },
    hireDate: {
      type: Date,
    },
    baseSalary: {
      type: Number,
      min: [0, "Base salary cannot be negative"],
    },
    salaryType: {
      type: String,
      enum: ["FULL_TIME", "PART_TIME"],
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
  },
  { timestamps: true },
);

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

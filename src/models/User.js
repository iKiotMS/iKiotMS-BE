const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "TENANT_OWNER",
        "BRANCH_MANAGER",
        "WAREHOUSE_MANAGER",
        "BRANCH_STAFF",
        "CUSTOMER",
      ],
      required: [true, "Role is required"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    lastLogin: {
      type: Date,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
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
)

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const bcryptjs = require("bcryptjs");
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  const bcryptjs = require("bcryptjs");
  return await bcryptjs.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

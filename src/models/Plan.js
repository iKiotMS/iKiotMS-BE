const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    planCode: {
      type: String,
      required: [true, "Plan code is required"],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      required: [true, "Billing cycle is required"],
    },
    maxBranches: {
      type: Number,
      required: [true, "Max branches is required"],
      min: [1, "Max branches must be at least 1"],
    },
    maxUsers: {
      type: Number,
      required: [true, "Max users is required"],
      min: [1, "Max users must be at least 1"],
    },
    maxWarehouses: {
      type: Number,
      required: [true, "Max warehouses is required"],
      min: [1, "Max warehouses must be at least 1"],
    },
    maxProducts: {
      type: Number,
      required: [true, "Max products is required"],
      min: [1, "Max products must be at least 1"],
    },
    trialDays: {
      type: Number,
      required: [true, "Trial days is required"],
      min: [0, "Trial days cannot be negative"],
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Plan", planSchema);

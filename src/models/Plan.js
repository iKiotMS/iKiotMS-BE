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
      enum: ["MONTHLY", "YEARLY", "NONE"],
      default: "NONE",
    },
    // -1 = unlimited
    maxBranches: {
      type: Number,
      required: [true, "Max branches is required"],
    },
    maxUsers: {
      type: Number,
      required: [true, "Max users is required"],
    },
    maxProducts: {
      type: Number,
      required: [true, "Max products is required"],
    },
    trialDays: {
      type: Number,
      required: [true, "Trial days is required"],
      min: [0, "Trial days cannot be negative"],
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Plan", planSchema);

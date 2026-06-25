require("dotenv").config();
const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const { PLAN_FEATURES } = require("../constants/planFeatures");

// Tất cả plan có đầy đủ features
const ALL_FEATURES = [
  PLAN_FEATURES.STOCK_MOVEMENT,
  PLAN_FEATURES.SALES,
  PLAN_FEATURES.REPORTS,
  PLAN_FEATURES.HR_MANAGEMENT,
  PLAN_FEATURES.PAYROLL,
];

const plans = [
  {
    planName: "Trial",
    planCode: "TRIAL",
    price: 0,
    billingCycle: "NONE",
    trialDays: 7,
    maxBranches: 2,
    maxUsers: 2,
    maxProducts: 100,
    features: ALL_FEATURES,
    isActive: true,
  },
  {
    planName: "Plus",
    planCode: "PLUS",
    price: 0, // TODO: cập nhật giá
    billingCycle: "MONTHLY",
    trialDays: 0,
    maxBranches: 3,
    maxUsers: 5,
    maxProducts: 1000,
    features: ALL_FEATURES,
    isActive: true,
  },
  {
    planName: "Pro",
    planCode: "PRO",
    price: 0, // TODO: cập nhật giá
    billingCycle: "MONTHLY",
    trialDays: 0,
    maxBranches: -1, // unlimited
    maxUsers: -1, // unlimited
    maxProducts: -1, // unlimited
    features: ALL_FEATURES,
    isActive: true,
  },
];

async function seed() {
  await mongoose.connect(process.env.CONNECTION_STRING);
  console.log("Connected to MongoDB");

  for (const plan of plans) {
    await Plan.findOneAndUpdate({ planCode: plan.planCode }, plan, {
      upsert: true,
      new: true,
      runValidators: true,
    });
    console.log(`✓ Upserted plan: ${plan.planCode}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
    description: "Khám phá toàn bộ tính năng iKiot miễn phí trong 7 ngày.",
    displayFeatures: [
      "Dùng thử 7 ngày miễn phí",
      "Tối đa 2 chi nhánh",
      "Tối đa 100 sản phẩm",
      "Tối đa 2 nhân viên",
      "Bán hàng POS & báo cáo cơ bản",
    ],
    isPopular: false,
    isActive: true,
  },
  {
    planName: "Plus",
    planCode: "PLUS",
    price: 99000, // VND/tháng
    billingCycle: "MONTHLY",
    trialDays: 0,
    maxBranches: 3,
    maxUsers: 5,
    maxProducts: 1000,
    features: ALL_FEATURES,
    description:
      "Phù hợp cho chuỗi cửa hàng vừa và nhỏ có nhu cầu đồng bộ đa chi nhánh.",
    displayFeatures: [
      "Tối đa 3 chi nhánh",
      "Tối đa 1.000 sản phẩm",
      "Tối đa 5 nhân viên",
      "Quản lý kho & chuyển kho chi nhánh",
      "Quản lý nhân sự & bảng lương",
    ],
    isPopular: true,
    isActive: true,
  },
  {
    planName: "Plus Năm",
    planCode: "PLUS_YEARLY",
    price: 948000, // VND/năm (79.000đ/tháng, tiết kiệm 20% so với 99.000đ)
    billingCycle: "YEARLY",
    trialDays: 0,
    maxBranches: 3,
    maxUsers: 5,
    maxProducts: 1000,
    features: ALL_FEATURES,
    description:
      "Phù hợp cho chuỗi cửa hàng vừa và nhỏ có nhu cầu đồng bộ đa chi nhánh.",
    displayFeatures: [
      "Tối đa 3 chi nhánh",
      "Tối đa 1.000 sản phẩm",
      "Tối đa 5 nhân viên",
      "Quản lý kho & chuyển kho chi nhánh",
      "Quản lý nhân sự & bảng lương",
    ],
    isPopular: true,
    isActive: true,
  },
  {
    planName: "Pro",
    planCode: "PRO",
    price: 299000, // VND/tháng
    billingCycle: "MONTHLY",
    trialDays: 0,
    maxBranches: -1, // unlimited
    maxUsers: -1, // unlimited
    maxProducts: -1, // unlimited
    features: ALL_FEATURES,
    description: "Giải pháp toàn diện không giới hạn cho chuỗi cửa hàng lớn.",
    displayFeatures: [
      "Không giới hạn chi nhánh",
      "Không giới hạn sản phẩm",
      "Không giới hạn nhân viên",
      "Tất cả tính năng gói Plus",
      "Hỗ trợ ưu tiên",
    ],
    isPopular: false,
    isActive: true,
  },
  {
    planName: "Pro Năm",
    planCode: "PRO_YEARLY",
    price: 2868000, // VND/năm (239.000đ/tháng, tiết kiệm 20% so với 299.000đ)
    billingCycle: "YEARLY",
    trialDays: 0,
    maxBranches: -1, // unlimited
    maxUsers: -1, // unlimited
    maxProducts: -1, // unlimited
    features: ALL_FEATURES,
    description: "Giải pháp toàn diện không giới hạn cho chuỗi cửa hàng lớn.",
    displayFeatures: [
      "Không giới hạn chi nhánh",
      "Không giới hạn sản phẩm",
      "Không giới hạn nhân viên",
      "Tất cả tính năng gói Plus",
      "Hỗ trợ ưu tiên",
    ],
    isPopular: false,
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

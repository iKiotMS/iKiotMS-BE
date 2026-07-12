const mongoose = require("mongoose");

const promotionLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      required: [true, "Promotion is required"],
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    discountAmount: {
      type: Number,
      required: [true, "Discount amount is required"],
      min: [0, "Discount amount cannot be negative"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

promotionLogSchema.index({ tenantId: 1, promotionId: 1, createdAt: -1 });
promotionLogSchema.index(
  { orderId: 1, promotionId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $exists: true } } },
);

module.exports = mongoose.model("PromotionLog", promotionLogSchema);

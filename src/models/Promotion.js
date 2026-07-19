const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    // Empty array = applies tenant-wide. Non-empty = only at these branches.
    branchIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }],
      default: [],
    },
    promoName: {
      type: String,
      required: [true, "Promotion name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["PERCENT", "FIXED_AMOUNT"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, "Max discount amount cannot be negative"],
      default: null,
    },
    minOrderValue: {
      type: Number,
      min: [0, "Min order value cannot be negative"],
      default: 0,
    },
    applicableRule: {
      type: {
        type: String,
        enum: ["all", "category", "product"],
        required: true,
      },
      categoryIds: [mongoose.Schema.Types.ObjectId],
      productItemIds: [mongoose.Schema.Types.ObjectId],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    stackable: {
      type: Boolean,
      default: false,
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
      default: null,
    },
    usageLimitPerCustomer: {
      type: Number,
      min: [1, "Usage limit per customer must be at least 1"],
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

promotionSchema.index({ tenantId: 1, status: 1 });
promotionSchema.index({ tenantId: 1, branchIds: 1 });
promotionSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model("Promotion", promotionSchema);

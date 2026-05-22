const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    promoName: {
      type: String,
      required: [true, "Promotion name is required"],
      trim: true,
    },
    discountPercent: {
      type: Number,
      required: [true, "Discount percent is required"],
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Promotion", promotionSchema);

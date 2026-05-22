const mongoose = require("mongoose");

const productItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    productCode: {
      type: String,
      required: [true, "Product code is required"],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      index: { unique: true, sparse: true },
    },
    barcode: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    retailPrice: {
      type: Number,
      required: [true, "Retail price is required"],
      min: [0, "Retail price cannot be negative"],
    },
    costPrice: {
      type: Number,
      required: [true, "Cost price is required"],
      min: [0, "Cost price cannot be negative"],
    },
    productSlug: {
      type: String,
      trim: true,
    },
    warrantyPeriod: {
      type: String,
      trim: true,
    },
    VAT: {
      type: Number,
      min: [0, "VAT cannot be negative"],
      max: [100, "VAT cannot exceed 100"],
    },
    productDetails: [
      {
        name: String,
        value: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("ProductItem", productItemSchema);

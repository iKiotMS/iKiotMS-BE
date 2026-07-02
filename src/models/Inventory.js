const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Location is required"],
    },
    locationType: {
      type: String,
      enum: ["branch", "warehouse"],
      required: [true, "Location type is required"],
    },
    productItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductItem",
      required: [true, "Product item is required"],
    },
    stock: {
      type: Number,
      required: [true, "Stock is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
  },
  { timestamps: true },
);

inventorySchema.index(
  { tenantId: 1, locationId: 1, productItemId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);

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
    // Ngưỡng cảnh báo tồn kho thấp, đặt riêng cho từng địa điểm (một mặt hàng
    // có thể cần tồn nhiều ở kho tổng nhưng rất ít ở chi nhánh nhỏ).
    // 0 = tắt cảnh báo cho mặt hàng này.
    minStock: {
      type: Number,
      min: [0, "Minimum stock cannot be negative"],
      default: 0,
    },
  },
  { timestamps: true },
);

// Quét các mặt hàng đang dưới ngưỡng: cần lọc theo tenant/địa điểm trước,
// so sánh stock <= minStock phải làm bằng $expr nên không index được trực tiếp.
inventorySchema.index({ tenantId: 1, locationId: 1, minStock: 1 });

inventorySchema.index(
  { tenantId: 1, locationId: 1, productItemId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);

const mongoose = require("mongoose");

const stockMovementRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    movementType: {
      type: String,
      enum: ["EXPORT", "RETURN", "ADJUST", "IMPORT"],
      // WH: EXPORT", "RETURN", "ADJUST", "IMPORT (nhập hàng từ Supplier)
      // BRANCH MANA: EXPORT, RETURN, ADJUST
      required: [true, "Movement type is required"],
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING",
        "OPENING",
        "CLOSED",
        "IN_TRANSIT",
        "RECEIVED",
        "CANCELLED",
        "COMPLETED",
      ],
      // Người tạo:  chuyển trạng thái từ DRAFT sang OPENING.
      //             chuyển trạng thái từ OPENING sang CLOSED.
      //             chuyển từ CLOSED sang IN_TRANSIT.
      //             chuyển trạng thái từ IN_TRANSIT sang CANCELLED.

      // Người nhận: chuyển trạng thái từ IN_TRANSIT sang RECEIVED
      //             chuyển trạng thái từ IN_TRANSIT sang CANCELLED.

      default: "DRAFT",
    },
    fromSupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    fromLocationId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    fromLocationType: {
      type: String,
      enum: ["branch", "warehouse"],
    },
    toLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "To location is required"],
    },
    toLocationType: {
      type: String,
      enum: ["branch", "warehouse"],
      required: [true, "To location type is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    note: {
      type: String,
      trim: true,
    },
    details: [
      {
        productItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductItem",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [0, "Quantity cannot be negative"],

          // Đơn IMPORT / EXPORT / RETURN : min phải >= 1
          // Đơn ADJUST: min có thể là 0
        },
        importPrice: {
          type: Number,
          min: [0, "Import price cannot be negative"],
        },
        receivedQuantity: {
          type: Number,
          min: [0, "Received quantity cannot be negative"],
        },

        // Với đơn ADJUST: receivedQuantity = số lượng thực tế => sau nhập receivedQuatity thì cập nhật stock = receivedQuantity.

        note: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "StockMovementRequest",
  stockMovementRequestSchema,
);

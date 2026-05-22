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
      enum: ["TRANSFER", "RETURN", "ADJUST"],
      required: [true, "Movement type is required"],
    },
    status: {
      type: String,
      enum: ["PENDING", "IN_TRANSIT", "RECEIVED", "CANCELLED"],
      default: "PENDING",
    },
    fromLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "From location is required"],
    },
    fromLocationType: {
      type: String,
      enum: ["branch", "warehouse"],
      required: [true, "From location type is required"],
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
    userId: {
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
        deliveryStatus: {
          type: String,
          enum: ["PENDING", "DELIVERED", "FAILED"],
          default: "PENDING",
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, "Quantity must be at least 1"],
        },
        receivedQuantity: {
          type: Number,
          min: [0, "Received quantity cannot be negative"],
        },
        note: String,
        updatedBy: mongoose.Schema.Types.ObjectId,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "StockMovementRequest",
  stockMovementRequestSchema,
);

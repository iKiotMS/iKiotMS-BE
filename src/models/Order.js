const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch is required"],
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "CANCELLED", "RETURNED"],
      default: "PENDING",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY", "SEPAY"],
      required: [true, "Payment method is required"],
    },
    paymentReference: {
      type: String,
      unique: true,
      sparse: true,
    },
    sepayTransactionId: {
      type: Number,
    },
    grandTotal: {
      type: Number,
      required: [true, "Grand total is required"],
      min: [0, "Grand total cannot be negative"],
    },
    customerPay: {
      type: Number,
      min: [0, "Customer pay cannot be negative"],
    },
    change: {
      type: Number,
      min: [0, "Change cannot be negative"],
    },
    note: {
      type: String,
      trim: true,
    },
    items: [
      {
        productItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductItem",
          required: true,
        },
        productName: String,
        quantity: {
          type: Number,
          required: true,
          min: [1, "Quantity must be at least 1"],
        },
        unitPrice: {
          type: Number,
          required: true,
          min: [0, "Unit price cannot be negative"],
        },
        discountAmount: {
          type: Number,
          default: 0,
          min: [0, "Discount cannot be negative"],
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);

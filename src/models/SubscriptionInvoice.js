const mongoose = require("mongoose");

const subscriptionInvoiceSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: [true, "Subscription is required"],
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: [true, "Plan is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      enum: ["VND", "USD"],
      default: "VND",
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    billingPeriodStart: {
      type: Date,
      required: [true, "Billing period start is required"],
    },
    billingPeriodEnd: {
      type: Date,
      required: [true, "Billing period end is required"],
    },
    paidAt: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ["BANK_TRANSFER", "MOMO", "VNPAY"],
    },
    transactionRef: {
      type: String,
    },
    invoiceUrl: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "SubscriptionInvoice",
  subscriptionInvoiceSchema,
);

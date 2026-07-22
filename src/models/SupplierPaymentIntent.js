const mongoose = require("mongoose");

// Temporary record created when a supplier debt BANK_TRANSFER QR is generated.
// Expires automatically after 30 minutes. When SePay webhook fires and matches
// the paymentReference (SUP prefix), this record is used to complete the payment.
const supplierPaymentIntentSchema = new mongoose.Schema(
  {
    tenantId:         { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Tenant" },
    supplierId:       { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Supplier" },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    amount:           { type: Number, required: true },
    paymentReference: { type: String, required: true, unique: true },
    note:             { type: String },
    status:           { type: String, enum: ["PENDING", "COMPLETED"], default: "PENDING" },
    // TTL: auto-delete after 30 minutes if still PENDING
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SupplierPaymentIntent", supplierPaymentIntentSchema);

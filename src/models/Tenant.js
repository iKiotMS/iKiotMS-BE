const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    tenantOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    mainAddress: {
      type: String,
      trim: true,
    },
    taxNumber: {
      type: String,
      trim: true,
    },
    banking: {
      accountNumber: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountName: { type: String, trim: true },
      sepayWebhookApiKey: { type: String, select: false }, // hidden by default
    },
    workingPolicy: {
      
    }

  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);

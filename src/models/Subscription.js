const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
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
    status: {
      type: String,
      enum: ["TRIAL", "ACTIVE", "EXPIRED", "PAST_DUE", "CANCELLED"],
      default: "TRIAL",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    trialEndDate: {
      type: Date,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
    },
    currentQuotaSnapshot: {
      maxBranches: Number,
      maxUsers: Number,
      maxProducts: Number,
    },
    historyLogs: [
      {
        event: {
          type: String,
          enum: ["CREATED", "UPGRADED", "RENEWED", "CANCELLED"],
        },
        fromPlanId: mongoose.Schema.Types.ObjectId,
        toPlanId: mongoose.Schema.Types.ObjectId,
        changedAt: Date,
        changedBy: mongoose.Schema.Types.ObjectId,
        note: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);

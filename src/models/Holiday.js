const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    date: {
      type: Date,
      required: [true, "Holiday date is required"],
    },
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["PUBLIC_HOLIDAY", "COMPANY_HOLIDAY"],
      default: "PUBLIC_HOLIDAY",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ["GOOGLE_CALENDAR", "MANUAL"],
      default: "MANUAL",
    },
    isManuallyEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

holidaySchema.index(
  { tenantId: 1, date: 1, branchId: 1, type: 1 },
  { unique: true },
);

module.exports = mongoose.model("Holiday", holidaySchema);

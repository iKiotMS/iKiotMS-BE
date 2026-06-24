const mongoose = require("mongoose");
const { WAREHOUSE_STATUS } = require("../constants/warehouseConstants");

const warehouseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(WAREHOUSE_STATUS),
      default: WAREHOUSE_STATUS.ACTIVE,
    },
    address: {
      type: String,
      trim: true,
    },
    attendanceTakingLocation: {
      latitude: Number,
      longitude: Number,
      allowedRadiusMeters: {
        type: Number,
        default: 100,
      },
      maxAccuracyMeters: {
        type: Number,
        default: 100,
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Warehouse", warehouseSchema);

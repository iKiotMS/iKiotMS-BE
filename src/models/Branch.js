const mongoose = require("mongoose");
const { BRANCH_STATUS } = require("../constants/branchConstants");

const branchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(BRANCH_STATUS),
      default: BRANCH_STATUS.ACTIVE,
    },
    address: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: [String],
      required: true,
      validate: [
        {
          validator: function (arr) {
            return arr && arr.length > 0;
          },
          message: "Branch must have at least one phone number",
        },
      ],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    attendanceTakingLocation: {
      latitude: Number,
      longitude: Number,
      allowedRadiusMeters: {
        type: Number,
        default: 100,
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Branch", branchSchema);

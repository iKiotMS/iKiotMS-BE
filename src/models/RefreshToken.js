const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    token: {
      type: String,
      required: [true, "Token is required"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    userAgent: {
      type: String,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);

const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Brand", brandSchema);

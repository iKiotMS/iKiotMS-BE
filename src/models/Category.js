const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Category", categorySchema);

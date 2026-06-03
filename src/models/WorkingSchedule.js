const mongoose = require("mongoose");

const workingScheduleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    shiftTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftTemplate",
    },
    workDate: {
      type: Date,
    },
    startAt: {
      type: Date,
    },
    endAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WorkingSchedule", workingScheduleSchema);

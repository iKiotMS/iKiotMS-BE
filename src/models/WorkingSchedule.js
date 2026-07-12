const mongoose = require("mongoose");

const workingScheduleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant is required"],
    },
    userId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User is required"],
      },
    ],
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    scheduleType: {
      type: String,
      enum: ["NORMAL", "OVERTIME"],
      default: "NORMAL",
    },
    shiftTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftTemplate",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED", "DELETED"],
      default: "SCHEDULED",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WorkingSchedule", workingScheduleSchema);

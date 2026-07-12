const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
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
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkingSchedule",
    },
    workDate: {
      type: Date,
      required: true,
    },
    actualCheckinAt: {
      type: Date,
    },
    actualCheckoutAt: {
      type: Date,
    },
    workedMinutes: {
      type: Number,
      min: [0, "Worked minutes cannot be negative"],
    },
    overtimeMinute: {
      type: Number,
      min: [0, "Overtime minutes cannot be negative"],
    },
    lateMinutes: {
      type: Number,
      min: [0, "Late minutes cannot be negative"],
    },
    status: {
      type: String,
      enum: ["CHECKED_IN", "CHECKED_OUT", "ABSENT"],
      trim: true,
    },
    checkInLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      distance: Number,
      verificationStatus: {
        type: String,
        enum: ["VERIFIED", "LOW_ACCURACY", "OUT_OF_RANGE", "NO_LOCATION"],
        default: "VERIFIED",
      },
    },
    checkOutLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      distance: Number,
      verificationStatus: {
        type: String,
        enum: ["VERIFIED", "LOW_ACCURACY", "OUT_OF_RANGE", "NO_LOCATION"],
        default: "VERIFIED",
      },
    },
  },

  { timestamps: true },
);
attendanceSchema.index({ tenantId: 1, userId: 1, workDate: 1 });
attendanceSchema.index({ tenantId: 1, userId: 1, status: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);

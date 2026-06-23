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
    checkInLocation:{
      latitude: Number,
      longitude:Number,
      accuracy: Number,

    },
    checkOutLocation:{
      latitude: Number,
      longitude:Number,
      accuracy: Number,

    },
    checkInIpAddress: {
      type: String,
      trim: true,
    },
    checkOutIpAddress: {
      type: String,
      trim: true,
    },
    
  },

  { timestamps: true },
);

module.exports = mongoose.model("Attendance", attendanceSchema);

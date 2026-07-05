const mongoose = require("mongoose");
const { allowedLeaveTypes } = require("../../../constants/leaveRequest");

class CreateLeaveRequestDTO {
  constructor(tenantId, userId, data = {}) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.leaveType = data.leaveType;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.status = data.status || "PENDING";
    this.reason = data.reason ? data.reason.trim() : "";
    this.handoverToUserId = data.handoverToUserId || null;
  }

  validate() {
    const errors = {};

    if (!this.tenantId || !mongoose.Types.ObjectId.isValid(this.tenantId)) {
      errors.tenantId = "Valid tenantId is required";
    }

    if (!this.userId || !mongoose.Types.ObjectId.isValid(this.userId)) {
      errors.userId = "Valid userId is required";
    }

    if (!this.leaveType || typeof this.leaveType !== "string") {
      errors.leaveType = "Leave type is required and must be a string";
    } else if (!Object.values(allowedLeaveTypes).includes(this.leaveType)) {
      errors.leaveType = `Leave type must be one of: ${Object.values(allowedLeaveTypes).join(", ")}`;
    }

    const startDate = this.startDate ? new Date(this.startDate) : null;
    const endDate = this.endDate ? new Date(this.endDate) : null;
    const now = new Date();

    if (!this.startDate) {
      errors.startDate = "Start date is required";
    } else if (Number.isNaN(startDate.getTime())) {
      errors.startDate = "Start date must be a valid date";
    }

    if (!this.endDate) {
      errors.endDate = "End date is required";
    } else if (Number.isNaN(endDate.getTime())) {
      errors.endDate = "End date must be a valid date";
    }

    if (
      startDate &&
      endDate &&
      !Number.isNaN(startDate.getTime()) &&
      !Number.isNaN(endDate.getTime()) &&
      endDate < startDate
    ) {
      errors.endDate = "End date cannot be before start date";
    }

    if (
      startDate &&
      !Number.isNaN(startDate.getTime()) &&
      startDate < now
    ) {
      errors.startDate = "Start date cannot be before the current time";
    }

    if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) {
      errors.endDate = "End date cannot be before the current time";
    }

    if (
      !this.reason ||
      typeof this.reason !== "string" ||
      this.reason.trim() === ""
    ) {
      errors.reason = "Reason is required and must be a non-empty string";
    }

    if (
      this.handoverToUserId &&
      !mongoose.Types.ObjectId.isValid(this.handoverToUserId)
    ) {
      errors.handoverToUserId = "handoverToUserId must be a valid user id";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      statusCode: Object.keys(errors).length === 0 ? 200 : 400,
      errors,
    };
  }
}

module.exports = CreateLeaveRequestDTO;


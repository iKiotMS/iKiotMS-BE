const mongoose = require("mongoose");
const { allowedLeaveTypes } = require("../../../constants/leaveRequest");

class CreateLeaveRequestDTO {
 constructor(tenantId, userId, data = {} ) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.leaveType = data.leaveType;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.status = data.status || "PENDING";
    this.reason = data.reason ? data.reason.trim() : "";
 }  

 validate(){
    const errors = [];

    if (!this.tenantId || !mongoose.Types.ObjectId.isValid(this.tenantId)) {
      errors.push("Valid tenantId is required");
    }

    if (!this.userId || !mongoose.Types.ObjectId.isValid(this.userId)) {
      errors.push("Valid userId is required");
    }

    if (!this.leaveType || typeof this.leaveType !== "string") {
      errors.push("Leave type is required and must be a string");
    } else if (!Object.values(allowedLeaveTypes).includes(this.leaveType)) {
      errors.push(`Leave type must be one of: ${Object.values(allowedLeaveTypes).join(", ")}`);
    }

        if (!this.startDate) {
        errors.push("Start date is required");
        } else if (Number.isNaN(new Date(this.startDate).getTime())) {
        errors.push("Start date must be a valid date");
    }

    if (!this.endDate) {
      errors.push("End date is required");
    } else if (Number.isNaN(new Date(this.endDate).getTime())) {
      errors.push("End date must be a valid date");
    }

    if (
      this.startDate &&
      this.endDate &&
      !Number.isNaN(new Date(this.startDate).getTime()) &&
      !Number.isNaN(new Date(this.endDate).getTime()) &&
      new Date(this.endDate) < new Date(this.startDate)
    ) {
      errors.push("End date cannot be before start date");
    }

    if (
      this.startDate &&
      !Number.isNaN(new Date(this.startDate).getTime()) &&
      new Date(this.startDate) < new Date()
    ) {
      errors.push("Start date cannot be before the current time");
    }

    if (
      this.endDate &&
      !Number.isNaN(new Date(this.endDate).getTime()) &&
      new Date(this.endDate) < new Date()
    ) {
      errors.push("End date cannot be before the current time");
    }

    if (!this.reason || typeof this.reason !== "string" || this.reason.trim() === "") {
      errors.push("Reason is required and must be a non-empty string");
    }

    return {
      isValid: errors.length === 0,
      statusCode: errors.length === 0 ? 200 : 400,
      errors,
    };
 }
}

module.exports = CreateLeaveRequestDTO;

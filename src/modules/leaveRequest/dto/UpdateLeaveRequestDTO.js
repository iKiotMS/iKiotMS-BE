class UpdateLeaveRequestDTO {
  constructor(data = {}) {
    this.leaveType = data.leaveType;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.reason = data.reason;
    this.status = data.status;
    this.reviewNote = data.reviewNote;
    this.approvedBy = data.approvedBy;
  }

  validate() {
    const errors = {};

    if (
      this.leaveType !== undefined &&
      !["ANNUAL", "UNPAID", "SICK", "OTHER"].includes(this.leaveType)
    ) {
      errors.leaveType = "Invalid leaveType";
    }

    if (
      this.status !== undefined &&
      !["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED", "DELETED"].includes(this.status)
    ) {
      errors.status = "Invalid status";
    }

    if (
      this.startDate !== undefined &&
      Number.isNaN(new Date(this.startDate).getTime())
    ) {
      errors.startDate = "startDate must be a valid date";
    }

    if (
      this.endDate !== undefined &&
      Number.isNaN(new Date(this.endDate).getTime())
    ) {
      errors.endDate = "endDate must be a valid date";
    }

    if (
      this.reason !== undefined &&
      (typeof this.reason !== "string" || this.reason.trim() === "")
    ) {
      errors.reason = "reason must be a non-empty string";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      statusCode: Object.keys(errors).length === 0 ? 200 : 400,
      errors,
    };
  }

  toUpdateData() {
    const updateData = {};

    [
      "leaveType",
      "startDate",
      "endDate",
      "reason",
      "status",
      "reviewNote",
      "approvedBy",
    ].forEach((field) => {
      if (this[field] !== undefined) {
        updateData[field] = this[field];
      }
    });

    return updateData;
  }
}

module.exports = UpdateLeaveRequestDTO;

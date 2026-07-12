class UpdateLeaveRequestDTO {
  constructor(data = {}) {
    this.paidLeaveDays = data.paidLeaveDays !== undefined ? Number(data.paidLeaveDays) : undefined;
    this.unpaidLeaveDays = data.unpaidLeaveDays !== undefined ? Number(data.unpaidLeaveDays) : undefined;
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
      this.paidLeaveDays !== undefined &&
      (Number.isNaN(this.paidLeaveDays) || this.paidLeaveDays < 0)
    ) {
      errors.paidLeaveDays = "Số ngày nghỉ có lương phải là số không âm";
    }

    if (
      this.unpaidLeaveDays !== undefined &&
      (Number.isNaN(this.unpaidLeaveDays) || this.unpaidLeaveDays < 0)
    ) {
      errors.unpaidLeaveDays = "Số ngày nghỉ không lương phải là số không âm";
    }

    if (
      this.status !== undefined &&
      ![
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "EXPIRED",
        "DELETED",
      ].includes(this.status)
    ) {
      errors.status = "Trạng thái đơn nghỉ phép không hợp lệ";
    }

    if (
      this.startDate !== undefined &&
      Number.isNaN(new Date(this.startDate).getTime())
    ) {
      errors.startDate = "Ngày bắt đầu không hợp lệ";
    }

    if (
      this.endDate !== undefined &&
      Number.isNaN(new Date(this.endDate).getTime())
    ) {
      errors.endDate = "Ngày kết thúc không hợp lệ";
    }

    if (
      this.reason !== undefined &&
      (typeof this.reason !== "string" || this.reason.trim() === "")
    ) {
      errors.reason = "Lý do nghỉ phép không được để trống";
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
      "paidLeaveDays",
      "unpaidLeaveDays",
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

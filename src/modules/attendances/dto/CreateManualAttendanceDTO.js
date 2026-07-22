class CreateManualAttendanceDTO {
  constructor(data = {}) {
    this.scheduleId = data.scheduleId;
    this.userId = data.userId;
    this.status = String(data.status || "").trim().toUpperCase();
    this.actualCheckinAt = data.actualCheckinAt
      ? new Date(data.actualCheckinAt)
      : null;
    this.actualCheckoutAt = data.actualCheckoutAt
      ? new Date(data.actualCheckoutAt)
      : null;
    this.reason = typeof data.reason === "string" ? data.reason.trim() : "";
  }

  validate() {
    const errors = {};
    if (!this.scheduleId) errors.scheduleId = "Thiếu ca làm việc";
    if (!this.userId) errors.userId = "Thiếu nhân viên";
    if (!["CHECKED_IN", "CHECKED_OUT", "ABSENT"].includes(this.status)) {
      errors.status = "Trạng thái phải là CHECKED_IN, CHECKED_OUT hoặc ABSENT";
    }
    if (this.status !== "ABSENT") {
      if (!this.actualCheckinAt || Number.isNaN(this.actualCheckinAt.getTime())) {
        errors.actualCheckinAt = "Giờ check-in không hợp lệ";
      }
      if (
        this.status === "CHECKED_OUT" &&
        (!this.actualCheckoutAt ||
          Number.isNaN(this.actualCheckoutAt.getTime()))
      ) {
        errors.actualCheckoutAt = "Giờ check-out không hợp lệ";
      }
    }
    if (!this.reason) errors.reason = "Lý do là bắt buộc";
    else if (this.reason.length > 500) {
      errors.reason = "Lý do không được vượt quá 500 ký tự";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = CreateManualAttendanceDTO;

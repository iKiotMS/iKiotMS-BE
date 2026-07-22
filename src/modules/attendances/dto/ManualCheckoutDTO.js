class ManualCheckoutDTO {
  constructor(data = {}) {
    this.actualCheckoutAt = data.actualCheckoutAt
      ? new Date(data.actualCheckoutAt)
      : null;
    this.reason = typeof data.reason === "string" ? data.reason.trim() : "";
  }

  validate() {
    const errors = {};

    if (!this.actualCheckoutAt || Number.isNaN(this.actualCheckoutAt.getTime())) {
      errors.actualCheckoutAt = "Giờ check-out không hợp lệ";
    }
    if (!this.reason) {
      errors.reason = "Lý do điều chỉnh là bắt buộc";
    } else if (this.reason.length > 500) {
      errors.reason = "Lý do không được vượt quá 500 ký tự";
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = ManualCheckoutDTO;

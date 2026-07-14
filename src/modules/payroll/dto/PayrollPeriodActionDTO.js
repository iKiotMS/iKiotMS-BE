class PayrollPeriodActionDTO {
  constructor(data = {}) {
    this.reason = data.reason;
    this.paymentMethod = data.paymentMethod;
    this.paymentReference = data.paymentReference;
    this.paymentNote = data.paymentNote;
  }

  validate(action) {
    const errors = {};

    if (action === "RETURN_TO_DRAFT" && !this.reason?.trim()) {
      errors.reason = "Lý do trả lại bản nháp là bắt buộc";
    }
    if (
      action === "MARK_PAID" &&
      this.paymentMethod !== undefined &&
      this.paymentMethod !== "CASH"
    ) {
      errors.paymentMethod = "Thanh toán lương hiện chỉ hỗ trợ CASH";
    }
    if (
      this.paymentReference !== undefined &&
      typeof this.paymentReference !== "string"
    ) {
      errors.paymentReference = "Mã tham chiếu thanh toán phải là chuỗi";
    }
    if (this.paymentNote !== undefined && typeof this.paymentNote !== "string") {
      errors.paymentNote = "Ghi chú thanh toán phải là chuỗi";
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = PayrollPeriodActionDTO;

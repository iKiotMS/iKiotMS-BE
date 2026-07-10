const ALLOWED_METHODS = ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY"];

class PayOfflineOrderDTO {
  constructor(data = {}) {
    this.paymentMethod = data.paymentMethod ?? "CASH";
    this.customerPay = data.customerPay;
    this.note = data.note;
  }

  validate() {
    const errors = {};

    if (!ALLOWED_METHODS.includes(this.paymentMethod)) {
      errors.paymentMethod = `Must be one of: ${ALLOWED_METHODS.join(", ")}`;
    }

    if (this.customerPay != null) {
      if (typeof this.customerPay !== "number" || Number.isNaN(this.customerPay)) {
        errors.customerPay = "customerPay must be a number";
      } else if (this.customerPay < 0) {
        errors.customerPay = "customerPay cannot be negative";
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = PayOfflineOrderDTO;

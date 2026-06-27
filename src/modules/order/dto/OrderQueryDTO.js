const ORDER_STATUSES = ["PENDING", "COMPLETED", "CANCELLED", "RETURNED"];
const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY", "SEPAY"];

class OrderQueryDTO {
  constructor(query = {}) {
    this.page = parseInt(query.page) || 1;
    this.limit = Math.min(parseInt(query.limit) || 20, 100);
    this.status = query.status;
    this.paymentMethod = query.paymentMethod;
    this.customerId = query.customerId;
    this.branchId = query.branchId;
    this.search = query.search?.trim();
    this.fromDate = query.fromDate;
    this.toDate = query.toDate;
  }

  validate() {
    const errors = {};

    if (this.page < 1) errors.page = "page must be >= 1";
    if (this.status && !ORDER_STATUSES.includes(this.status))
      errors.status = `Must be one of: ${ORDER_STATUSES.join(", ")}`;
    if (this.paymentMethod && !PAYMENT_METHODS.includes(this.paymentMethod))
      errors.paymentMethod = `Must be one of: ${PAYMENT_METHODS.join(", ")}`;

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = OrderQueryDTO;

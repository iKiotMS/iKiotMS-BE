const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MOMO", "VNPAY", "SEPAY"];

class CreateOrderDTO {
  constructor(data = {}) {
    this.customerId = data.customerId;
    this.branchId = data.branchId;
    this.paymentMethod = data.paymentMethod;
    this.items = data.items || [];
    this.grandTotal = data.grandTotal;
    this.customerPay = data.customerPay;
    this.note = data.note;
  }

  validate() {
    const errors = {};

    if (!this.customerId) errors.customerId = "Customer is required";
    if (!this.branchId) errors.branchId = "Branch is required";

    if (!this.paymentMethod) {
      errors.paymentMethod = "Payment method is required";
    } else if (!PAYMENT_METHODS.includes(this.paymentMethod)) {
      errors.paymentMethod = `Must be one of: ${PAYMENT_METHODS.join(", ")}`;
    }

    if (!Array.isArray(this.items) || this.items.length === 0) {
      errors.items = "At least one item is required";
    } else {
      const itemErrors = [];
      this.items.forEach((item, i) => {
        const e = {};
        if (!item.productItemId) e.productItemId = "productItemId is required";
        if (!item.quantity || item.quantity < 1) e.quantity = "quantity must be >= 1";
        if (item.unitPrice == null || item.unitPrice < 0) e.unitPrice = "unitPrice must be >= 0";
        if (item.discountAmount != null && item.discountAmount < 0)
          e.discountAmount = "discountAmount must be >= 0";
        if (Object.keys(e).length) itemErrors[i] = e;
      });
      if (itemErrors.length) errors.items = itemErrors;
    }

    if (this.grandTotal == null || this.grandTotal < 0) {
      errors.grandTotal = "grandTotal must be >= 0";
    }

    if (
      this.paymentMethod === "CASH" &&
      this.customerPay != null &&
      this.customerPay < this.grandTotal
    ) {
      errors.customerPay = "customerPay cannot be less than grandTotal";
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = CreateOrderDTO;

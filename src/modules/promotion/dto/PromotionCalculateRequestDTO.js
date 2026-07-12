class PromotionCalculateRequestDTO {
  constructor(data = {}) {
    this.branchId = data.branchId || null;
    this.customerId = data.customerId || null;
    this.orderId = data.orderId || null;
    this.items = Array.isArray(data.items) ? data.items : [];
  }

  validate() {
    const errors = [];

    if (this.items.length === 0) {
      errors.push("At least one cart item is required");
    } else {
      this.items.forEach((item, index) => {
        if (!item.productItemId) errors.push(`items[${index}]: productItemId is required`);
        if (!Number.isFinite(item.quantity) || item.quantity < 1) {
          errors.push(`items[${index}]: quantity must be at least 1`);
        }
        if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
          errors.push(`items[${index}]: unitPrice must be a non-negative number`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = PromotionCalculateRequestDTO;

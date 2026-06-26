const ALLOWED_STATUSES = ["COMPLETED", "CANCELLED", "RETURNED"];

class UpdateOrderStatusDTO {
  constructor(data = {}) {
    this.status = data.status;
  }

  validate() {
    const errors = {};

    if (!this.status) {
      errors.status = "status is required";
    } else if (!ALLOWED_STATUSES.includes(this.status)) {
      errors.status = `Must be one of: ${ALLOWED_STATUSES.join(", ")}`;
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = UpdateOrderStatusDTO;

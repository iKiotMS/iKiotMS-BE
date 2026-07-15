class FinalizeCashDrawerDTO {
  constructor(data = {}) {
    this.finalAmount = data.finalAmount;
    this.note = data.note;
  }

  validate() {
    const errors = {};
    if (
      typeof this.finalAmount !== "number" ||
      !Number.isFinite(this.finalAmount) ||
      !Number.isInteger(this.finalAmount) ||
      this.finalAmount < 0
    ) {
      errors.finalAmount = "finalAmount must be a non-negative integer";
    }
    if (this.note !== undefined && typeof this.note !== "string") {
      errors.note = "note must be a string";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = FinalizeCashDrawerDTO;

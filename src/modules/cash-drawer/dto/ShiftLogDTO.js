class ShiftLogDTO {
  constructor(data = {}) {
    this.amount = data.amount;
    this.nextStaffId = data.nextStaffId;
    this.note = data.note;
  }

  validate() {
    const errors = {};
    if (
      typeof this.amount !== "number" ||
      !Number.isFinite(this.amount) ||
      !Number.isInteger(this.amount) ||
      this.amount < 0
    ) {
      errors.amount = "amount must be a non-negative integer";
    }
    if (this.note !== undefined && typeof this.note !== "string") {
      errors.note = "note must be a string";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = ShiftLogDTO;

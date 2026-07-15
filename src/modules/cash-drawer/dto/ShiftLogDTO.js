class ShiftLogDTO {
  constructor(data = {}) {
    this.type = data.type ?? "END";
    this.amount = data.amount;
    this.nextStaffId = data.nextStaffId;
    this.note = data.note;
  }

  validate() {
    const errors = {};
    if (!["START", "END"].includes(this.type)) {
      errors.type = "type must be START or END";
    }
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
    if (this.type === "START" && this.nextStaffId !== undefined) {
      errors.nextStaffId = "nextStaffId is only allowed for an END shift log";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = ShiftLogDTO;

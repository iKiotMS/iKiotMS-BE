class OpenCashDrawerDTO {
  constructor(data = {}) {
    this.branchId = data.branchId;
    this.openingAmount = data.openingAmount;
    this.staffId = data.staffId;
  }

  validate() {
    const errors = {};
    if (!this.branchId) errors.branchId = "branchId is required";
    if (!this.staffId) errors.staffId = "staffId is required";
    if (
      typeof this.openingAmount !== "number" ||
      !Number.isFinite(this.openingAmount) ||
      !Number.isInteger(this.openingAmount) ||
      this.openingAmount < 0
    ) {
      errors.openingAmount = "openingAmount must be a non-negative integer";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = OpenCashDrawerDTO;

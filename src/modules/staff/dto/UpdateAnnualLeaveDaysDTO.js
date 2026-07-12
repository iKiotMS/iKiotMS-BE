class UpdateAnnualLeaveDaysDTO {
  constructor(data = {}) {
    this.annualLeaveDays = data.annualLeaveDays;
  }

  validate() {
    const errors = {};

    if (this.annualLeaveDays === undefined) {
      errors.annualLeaveDays = "annualLeaveDays là bắt buộc";
    } else if (
      typeof this.annualLeaveDays !== "number" ||
      !Number.isFinite(this.annualLeaveDays) ||
      this.annualLeaveDays < 0
    ) {
      errors.annualLeaveDays =
        "annualLeaveDays phải là một số không âm";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

module.exports = UpdateAnnualLeaveDaysDTO;

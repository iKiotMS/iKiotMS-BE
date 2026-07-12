class SyncVietnamHolidayDTO {
  constructor(data = {}) {
    this.year = Number(data.year);
  }

  validate() {
    const errors = {};
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(this.year)) {
      errors.year = "Year must be an integer";
    } else if (this.year < 2000 || this.year > currentYear + 5) {
      errors.year = `Year must be between 2000 and ${currentYear + 5}`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

module.exports = SyncVietnamHolidayDTO;

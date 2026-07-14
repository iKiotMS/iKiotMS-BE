class CashDrawerQueryDTO {
  constructor(query = {}) {
    this.branchId = query.branchId;
    this.fromDate = query.fromDate;
    this.toDate = query.toDate;
    this.status = query.status;
    this.page = Number(query.page ?? 1);
    this.limit = Number(query.limit ?? 20);
  }

  validate() {
    const errors = {};
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (this.fromDate && !datePattern.test(this.fromDate)) {
      errors.fromDate = "fromDate must use YYYY-MM-DD";
    }
    if (this.toDate && !datePattern.test(this.toDate)) {
      errors.toDate = "toDate must use YYYY-MM-DD";
    }
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      errors.toDate = "toDate must be on or after fromDate";
    }
    if (this.status && !["OPEN", "CLOSED"].includes(this.status)) {
      errors.status = "status must be OPEN or CLOSED";
    }
    if (!Number.isInteger(this.page) || this.page < 1) {
      errors.page = "page must be an integer >= 1";
    }
    if (!Number.isInteger(this.limit) || this.limit < 1 || this.limit > 100) {
      errors.limit = "limit must be an integer between 1 and 100";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = CashDrawerQueryDTO;

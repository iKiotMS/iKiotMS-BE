class ListPayrollPeriodDTO {
  constructor(query) {
    this.page = query.page === undefined ? 1 : Number(query.page);
    this.limit = query.limit === undefined ? 20 : Number(query.limit);
    this.status = query.status;
  }

  validate() {
    const errors = {};
    if (!Number.isInteger(this.page) || this.page < 1) {
      errors.page = "page phải là số nguyên dương";
    }
    if (!Number.isInteger(this.limit) || this.limit < 1 || this.limit > 100) {
      errors.limit = "limit phải từ 1 đến 100";
    }
    if (
      this.status !== undefined &&
      !["DRAFT", "REVIEW", "APPROVED", "PAID", "CANCELLED"].includes(
        this.status,
      )
    ) {
      errors.status = "Trạng thái kỳ lương không hợp lệ";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = ListPayrollPeriodDTO;

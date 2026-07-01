class CustomerQueryDTO {
  constructor(query = {}) {
    this.page = parseInt(query.page) || 1;
    this.limit = Math.min(parseInt(query.limit) || 20, 100);
    this.search = query.search?.trim();
    this.branchId = query.branchId?.trim();
  }

  validate() {
    const errors = {};
    if (this.page < 1) errors.page = "page must be >= 1";
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = CustomerQueryDTO;

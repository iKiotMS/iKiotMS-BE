class ProductQueryDTO {
  constructor(query = {}) {
    this.page = parseInt(query.page) || 1;
    this.limit = parseInt(query.limit) || 20;
    this.search = query.search || "";
    this.categoryId = query.categoryId;
    this.status = query.status;
  }

  validate() {
    const errors = [];

    if (this.page < 1) {
      errors.push("Page must be greater than or equal to 1");
    }

    if (this.limit < 1 || this.limit > 100) {
      errors.push("Limit must be between 1 and 100");
    }

    if (this.status && !["ACTIVE", "INACTIVE", "DISCONTINUED"].includes(this.status)) {
      errors.push("Invalid status. Must be ACTIVE, INACTIVE, or DISCONTINUED");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = ProductQueryDTO;

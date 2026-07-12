class PromotionQueryDTO {
  constructor(query = {}) {
    this.page = parseInt(query.page) || 1;
    this.recordPerPage = parseInt(query.recordPerPage) || 10;
    this.search = query.search || "";
    this.status = query.status;
    this.branchId = query.branchId;
  }

  validate() {
    const errors = [];

    if (this.page < 1) {
      errors.push("Page must be greater than or equal to 1");
    }

    if (this.recordPerPage < 1 || this.recordPerPage > 100) {
      errors.push("recordPerPage must be between 1 and 100");
    }

    if (this.status && !["ACTIVE", "INACTIVE"].includes(this.status)) {
      errors.push("Invalid status. Must be ACTIVE or INACTIVE");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = PromotionQueryDTO;

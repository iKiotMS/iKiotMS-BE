class BranchQueryDTO {
  constructor(query) {
    this.page = parseInt(query.page, 10) || 1;
    this.limit = parseInt(query.limit, 10) || 10;
    this.search = query.search ? query.search.trim() : null;
    this.status = query.status ? query.status.trim() : null;
  }

  validate() {
    const errors = [];

    if (this.page < 1) {
      errors.push("Page must be greater than or equal to 1");
    }

    if (this.limit < 1 || this.limit > 100) {
      errors.push("Limit must be between 1 and 100");
    }

    if (
      this.status &&
      !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(this.status)
    ) {
      errors.push(
        "Invalid status filter. Must be ACTIVE, INACTIVE, or SUSPENDED",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = BranchQueryDTO;

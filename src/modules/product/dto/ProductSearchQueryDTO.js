class ProductSearchQueryDTO {
  constructor(query = {}) {
    this.q = (query.q || "").trim();
    this.page = parseInt(query.page) || 1;
    this.limit = Math.min(parseInt(query.limit) || 20, 50);
    this.categoryId = query.categoryId;
    this.supplierId = query.supplierId;
    this.status = query.status;
    this.locationId = query.locationId;
    this.locationType = query.locationType;
  }

  validate() {
    const errors = [];

    if (this.page < 1) {
      errors.push("Page must be greater than or equal to 1");
    }

    if (this.limit < 1 || this.limit > 50) {
      errors.push("Limit must be between 1 and 50");
    }

    if (this.q && this.q.length < 2) {
      errors.push("Search query must be at least 2 characters");
    }

    if (
      this.status &&
      !["ACTIVE", "INACTIVE", "DISCONTINUED"].includes(this.status)
    ) {
      errors.push("Invalid status. Must be ACTIVE, INACTIVE, or DISCONTINUED");
    }

    if (this.locationId && !this.locationType) {
      errors.push("locationType is required when locationId is provided");
    }

    if (
      this.locationType &&
      !["branch", "warehouse"].includes(this.locationType)
    ) {
      errors.push("locationType must be either 'branch' or 'warehouse'");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = ProductSearchQueryDTO;

class InventoryQueryDTO {
  constructor(query) {
    this.page = parseInt(query.page, 10) || 1;
    this.limit = parseInt(query.limit, 10) || 10;
    this.locationId = query.locationId;
    this.locationType = query.locationType;
    this.isLowStock = query.isLowStock === "true" || query.isLowStock === true;
    this.search = query.search ? query.search.trim() : null;
  }

  validate() {
    const errors = [];

    if (this.page < 1) {
      errors.push("Page must be greater than or equal to 1");
    }

    if (this.limit < 1 || this.limit > 100) {
      errors.push("Limit must be between 1 and 100");
    }

    if (this.locationId && !this.locationType) {
      errors.push("locationType is required when locationId is provided");
    }

    if (this.locationType && !["branch", "warehouse"].includes(this.locationType)) {
      errors.push("locationType must be either 'branch' or 'warehouse'");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = InventoryQueryDTO;

class UpdateProductRequestDTO {
  constructor(data = {}) {
    // Only accept fields that are provided
    if (data.name !== undefined) this.name = data.name;
    if (data.brandId !== undefined) this.brandId = data.brandId;
    if (data.categoryId !== undefined) this.categoryId = data.categoryId;
    if (data.categoryName !== undefined) this.categoryName = data.categoryName;
    if (data.supplierId !== undefined) this.supplierId = data.supplierId;
    if (data.status !== undefined) this.status = data.status;
    if (data.images !== undefined) this.images = data.images;
  }

  validate() {
    const errors = [];

    if (this.name !== undefined && (typeof this.name !== "string" || this.name.trim() === "")) {
      errors.push("Product name must be a non-empty string");
    }

    if (this.status !== undefined && !["ACTIVE", "INACTIVE", "DISCONTINUED"].includes(this.status)) {
      errors.push("Invalid status. Must be ACTIVE, INACTIVE, or DISCONTINUED");
    }

    if (this.images !== undefined && !Array.isArray(this.images)) {
      errors.push("Images must be an array");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = UpdateProductRequestDTO;

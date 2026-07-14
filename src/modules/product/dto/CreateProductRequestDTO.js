class CreateProductRequestDTO {
  constructor(data = {}) {
    this.name = data.name;
    this.brandId = data.brandId;
    this.categoryId = data.categoryId;
    this.categoryName = data.categoryName;
    this.status = data.status || "ACTIVE";
    this.images = Array.isArray(data.images) ? data.images : [];
    this.items = data.items || [];
  }

  validate() {
    const errors = [];

    if (!this.name || typeof this.name !== "string" || this.name.trim() === "") {
      errors.push("Product name is required and must be a non-empty string");
    }

    if (!Array.isArray(this.items) || this.items.length === 0) {
      errors.push("At least one product item (variant) is required");
    } else {
      this.items.forEach((item, index) => {
        if (!item.productName) errors.push(`Item[${index}]: productName is required`);
        if (!item.productCode) errors.push(`Item[${index}]: productCode is required`);
        if (!item.sku) errors.push(`Item[${index}]: sku is required`);
        if (item.retailPrice === undefined || item.retailPrice < 0) {
          errors.push(`Item[${index}]: valid retailPrice is required`);
        }
        if (item.costPrice === undefined || item.costPrice < 0) {
          errors.push(`Item[${index}]: valid costPrice is required`);
        }
        if (item.VAT !== undefined && (item.VAT < 0 || item.VAT > 100)) {
          errors.push(`Item[${index}]: VAT must be between 0 and 100`);
        }
        if (item.images !== undefined && !Array.isArray(item.images)) {
          errors.push(`Item[${index}]: images must be an array`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = CreateProductRequestDTO;

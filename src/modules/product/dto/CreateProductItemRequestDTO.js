class CreateProductItemRequestDTO {
  constructor(data) {
    this.productName = data.productName;
    this.productCode = data.productCode;
    this.sku = data.sku;
    this.retailPrice = data.retailPrice;
    this.costPrice = data.costPrice;
    this.barcode = data.barcode;
    this.description = data.description;
    this.warrantyPeriod = data.warrantyPeriod;
    this.VAT = data.VAT;
    this.productDetails = data.productDetails;
    this.images = data.images;
    this.initialStock = data.initialStock;
  }

  validate() {
    const errors = [];

    if (!this.productName || typeof this.productName !== "string") {
      errors.push("Product name is required and must be a string");
    }

    if (!this.productCode || typeof this.productCode !== "string") {
      errors.push("Product code is required and must be a string");
    }

    if (!this.sku || typeof this.sku !== "string") {
      errors.push("SKU is required and must be a string");
    }

    if (this.retailPrice === undefined || typeof this.retailPrice !== "number" || this.retailPrice < 0) {
      errors.push("Retail price must be a non-negative number");
    }

    if (this.costPrice === undefined || typeof this.costPrice !== "number" || this.costPrice < 0) {
      errors.push("Cost price must be a non-negative number");
    }

    if (this.VAT !== undefined && (typeof this.VAT !== "number" || this.VAT < 0 || this.VAT > 100)) {
      errors.push("VAT must be a number between 0 and 100");
    }

    if (this.images !== undefined && !Array.isArray(this.images)) {
      errors.push("Images must be an array");
    }

    if (this.productDetails !== undefined && !Array.isArray(this.productDetails)) {
      errors.push("Product details must be an array");
    }

    if (this.initialStock !== undefined) {
      if (!Array.isArray(this.initialStock)) {
        errors.push("initialStock must be an array");
      } else {
        this.initialStock.forEach((stockItem, index) => {
          if (!stockItem.locationId) {
            errors.push(`initialStock[${index}].locationId is required`);
          }
          if (!["branch", "warehouse"].includes(stockItem.locationType)) {
            errors.push(`initialStock[${index}].locationType must be 'branch' or 'warehouse'`);
          }
          if (stockItem.stock === undefined || typeof stockItem.stock !== "number" || stockItem.stock < 0) {
            errors.push(`initialStock[${index}].stock must be a non-negative number`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = CreateProductItemRequestDTO;

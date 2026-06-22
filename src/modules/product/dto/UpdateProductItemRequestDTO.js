class UpdateProductItemRequestDTO {
  constructor(data) {
    if (data.productCode !== undefined) this.productCode = data.productCode;
    if (data.sku !== undefined) this.sku = data.sku;
    if (data.retailPrice !== undefined) this.retailPrice = data.retailPrice;
    if (data.costPrice !== undefined) this.costPrice = data.costPrice;
    if (data.barcode !== undefined) this.barcode = data.barcode;
    if (data.description !== undefined) this.description = data.description;
    if (data.warrantyPeriod !== undefined) this.warrantyPeriod = data.warrantyPeriod;
    if (data.VAT !== undefined) this.VAT = data.VAT;
    if (data.productDetails !== undefined) this.productDetails = data.productDetails;
    if (data.images !== undefined) this.images = data.images;
  }

  validate() {
    const errors = [];

    if (this.productCode !== undefined && (typeof this.productCode !== "string" || this.productCode.trim() === "")) {
      errors.push("Product code must be a non-empty string");
    }

    if (this.sku !== undefined && (typeof this.sku !== "string" || this.sku.trim() === "")) {
      errors.push("SKU must be a non-empty string");
    }

    if (this.retailPrice !== undefined && (typeof this.retailPrice !== "number" || this.retailPrice < 0)) {
      errors.push("Retail price must be a non-negative number");
    }

    if (this.costPrice !== undefined && (typeof this.costPrice !== "number" || this.costPrice < 0)) {
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

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = UpdateProductItemRequestDTO;

class UpdateMinStockDTO {
  constructor(data = {}) {
    this.minStock = data.minStock;
  }

  validate() {
    const errors = {};

    if (this.minStock === undefined || this.minStock === null) {
      errors.minStock = "minStock is required";
    } else {
      const value = Number(this.minStock);

      if (!Number.isFinite(value)) {
        errors.minStock = "minStock must be a number";
      } else if (value < 0) {
        errors.minStock = "minStock cannot be negative";
      } else if (!Number.isInteger(value)) {
        errors.minStock = "minStock must be an integer";
      } else {
        this.minStock = value;
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = UpdateMinStockDTO;

const mongoose = require("mongoose");

class AddSupplierToItemRequestDTO {
  constructor(data) {
    this.supplierId = data.supplierId;
  }

  validate() {
    const errors = {};

    if (!this.supplierId) {
      errors.supplierId = "Supplier ID is required";
    } else if (!mongoose.Types.ObjectId.isValid(this.supplierId)) {
      errors.supplierId = "Invalid Supplier ID format";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

module.exports = AddSupplierToItemRequestDTO;

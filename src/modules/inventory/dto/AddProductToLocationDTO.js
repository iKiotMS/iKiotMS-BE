const mongoose = require("mongoose");

class AddProductToLocationDTO {
  constructor(data) {
    this.locationId = data.locationId;
    this.locationType = data.locationType;
    this.productItemId = data.productItemId;
  }

  validate() {
    const errors = [];

    if (!this.locationId || !mongoose.Types.ObjectId.isValid(this.locationId)) {
      errors.push("Invalid or missing locationId");
    }

    if (!this.locationType || !["branch", "warehouse"].includes(this.locationType)) {
      errors.push("locationType must be either 'branch' or 'warehouse'");
    }

    if (!this.productItemId || !mongoose.Types.ObjectId.isValid(this.productItemId)) {
      errors.push("Invalid or missing productItemId");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = AddProductToLocationDTO;

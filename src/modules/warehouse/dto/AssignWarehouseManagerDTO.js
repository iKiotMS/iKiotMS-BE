const mongoose = require("mongoose");

class AssignWarehouseManagerDTO {
  constructor(data = {}) {
    this.staffId = data.staffId;
  }

  validate() {
    const errors = [];

    if (!this.staffId) {
      errors.push("staffId is required");
    } else if (!mongoose.Types.ObjectId.isValid(this.staffId)) {
      errors.push("staffId must be a valid ObjectId");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = AssignWarehouseManagerDTO;

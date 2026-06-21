const { WAREHOUSE_STATUS } = require("../../../constants/warehouseConstants");

class UpdateWarehouseRequestDTO {
  constructor(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.address !== undefined) this.address = data.address;
    if (data.status !== undefined) this.status = data.status;
  }

  validate() {
    const errors = [];

    if (this.name !== undefined && (typeof this.name !== "string" || this.name.trim() === "")) {
      errors.push("Warehouse name must be a non-empty string");
    }

    if (this.address !== undefined && typeof this.address !== "string") {
      errors.push("Address must be a string");
    }

    if (this.status !== undefined && !Object.values(WAREHOUSE_STATUS).includes(this.status)) {
      errors.push(`Invalid status. Must be one of: ${Object.values(WAREHOUSE_STATUS).join(", ")}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = UpdateWarehouseRequestDTO;

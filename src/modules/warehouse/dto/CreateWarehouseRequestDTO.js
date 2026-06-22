class CreateWarehouseRequestDTO {
  constructor(data) {
    this.name = data.name;
    this.address = data.address;
  }

  validate() {
    const errors = [];

    if (!this.name || typeof this.name !== "string" || this.name.trim() === "") {
      errors.push("Warehouse name is required and must be a non-empty string");
    }

    if (this.address !== undefined && typeof this.address !== "string") {
      errors.push("Address must be a string");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = CreateWarehouseRequestDTO;

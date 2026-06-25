class CreateWarehouseRequestDTO {
  constructor(data) {
    this.name = data.name;
    this.address = data.address;
    this.attendanceTakingLocation = data.attendanceTakingLocation;
  }

  validate() {
    const errors = [];

    if (!this.name || typeof this.name !== "string" || this.name.trim() === "") {
      errors.push("Warehouse name is required and must be a non-empty string");
    }

    if (this.address !== undefined && typeof this.address !== "string") {
      errors.push("Address must be a string");
    }

    if (this.attendanceTakingLocation !== undefined) {
      if (typeof this.attendanceTakingLocation !== "object") {
        errors.push("attendanceTakingLocation must be an object");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = CreateWarehouseRequestDTO;

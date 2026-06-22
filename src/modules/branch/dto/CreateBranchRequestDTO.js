class CreateBranchRequestDTO {
  constructor(data) {
    this.name = data.name;
    this.phoneNumber = data.phoneNumber;
    this.address = data.address;
    this.email = data.email;
  }

  validate() {
    const errors = [];

    if (!this.name || typeof this.name !== "string" || this.name.trim() === "") {
      errors.push("Branch name is required and must be a non-empty string");
    }

    if (!Array.isArray(this.phoneNumber) || this.phoneNumber.length === 0) {
      errors.push("phoneNumber must be an array with at least one element");
    } else {
      this.phoneNumber.forEach((phone, index) => {
        if (typeof phone !== "string" || phone.trim() === "") {
          errors.push(`phoneNumber[${index}] must be a valid string`);
        }
      });
    }

    if (this.email !== undefined) {
      if (typeof this.email !== "string" || !/^\S+@\S+\.\S+$/.test(this.email)) {
        errors.push("Email must be a valid email string");
      }
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

module.exports = CreateBranchRequestDTO;

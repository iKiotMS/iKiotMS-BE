const GENDERS = ["MALE", "FEMALE", "OTHER"];

class CreateCustomerDTO {
  constructor(data = {}) {
    this.customerCode = data.customerCode?.trim();
    this.name = data.name?.trim();
    this.phone = data.phone?.trim();
    this.gender = data.gender;
    this.address = data.address?.trim();
    this.dob = data.dob;
  }

  validate() {
    const errors = {};

    if (!this.name) errors.name = "Customer name is required";

    if (this.gender && !GENDERS.includes(this.gender))
      errors.gender = `Must be one of: ${GENDERS.join(", ")}`;

    if (this.dob && isNaN(new Date(this.dob).getTime()))
      errors.dob = "Invalid date format";

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = CreateCustomerDTO;

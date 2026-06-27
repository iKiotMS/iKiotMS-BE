const GENDERS = ["MALE", "FEMALE", "OTHER"];

class UpdateCustomerDTO {
  constructor(data = {}) {
    this.name = data.name?.trim();
    this.phone = data.phone?.trim();
    this.gender = data.gender;
    this.address = data.address?.trim();
    this.dob = data.dob;
  }

  validate() {
    const errors = {};

    if (this.name !== undefined && !this.name)
      errors.name = "name cannot be empty";

    if (this.gender && !GENDERS.includes(this.gender))
      errors.gender = `Must be one of: ${GENDERS.join(", ")}`;

    if (this.dob && isNaN(new Date(this.dob).getTime()))
      errors.dob = "Invalid date format";

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  toUpdateFields() {
    const fields = {};
    if (this.name !== undefined) fields.name = this.name;
    if (this.phone !== undefined) fields.phone = this.phone;
    if (this.gender !== undefined) fields.gender = this.gender;
    if (this.address !== undefined) fields.address = this.address;
    if (this.dob !== undefined) fields.dob = this.dob;
    return fields;
  }
}

module.exports = UpdateCustomerDTO;

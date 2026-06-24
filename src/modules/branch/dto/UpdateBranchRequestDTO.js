const { BRANCH_STATUS } = require("../../../constants/branchConstants");

class UpdateBranchRequestDTO {
  constructor(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.phoneNumber !== undefined) this.phoneNumber = data.phoneNumber;
    if (data.address !== undefined) this.address = data.address;
    if (data.email !== undefined) this.email = data.email;
    if (data.status !== undefined) this.status = data.status;
    if (data.attendanceTakingLocation !== undefined) this.attendanceTakingLocation = data.attendanceTakingLocation;
  }

  validate() {
    const errors = [];

    if (
      this.name !== undefined &&
      (typeof this.name !== "string" || this.name.trim() === "")
    ) {
      errors.push("Branch name must be a non-empty string");
    }

    if (this.phoneNumber !== undefined) {
      if (!Array.isArray(this.phoneNumber) || this.phoneNumber.length === 0) {
        errors.push("phoneNumber must be an array with at least one element");
      } else {
        this.phoneNumber.forEach((phone, index) => {
          if (typeof phone !== "string" || phone.trim() === "") {
            errors.push(`phoneNumber[${index}] must be a valid string`);
          }
        });
      }
    }

    if (this.email !== undefined) {
      if (
        typeof this.email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(this.email)
      ) {
        errors.push("Email must be a valid email string");
      }
    }

    if (this.address !== undefined && typeof this.address !== "string") {
      errors.push("Address must be a string");
    }

    if (
      this.status !== undefined &&
      !Object.values(BRANCH_STATUS).includes(this.status)
    ) {
      errors.push(
        `Invalid status. Must be one of: ${Object.values(BRANCH_STATUS).join(", ")}`,
      );
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

module.exports = UpdateBranchRequestDTO;

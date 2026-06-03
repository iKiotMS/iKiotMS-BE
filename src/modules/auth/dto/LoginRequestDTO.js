class LoginRequestDTO {
  constructor(phoneNumber, password) {
    this.phoneNumber = phoneNumber;
    this.password = password;
  }

  validate() {
    const errors = [];

    if (!this.phoneNumber || typeof this.phoneNumber !== "string") {
      errors.push("Phone number is required and must be a string");
    } else if (this.phoneNumber.trim().length < 10) {
      errors.push("Phone number must be valid");
    }

    if (!this.password || typeof this.password !== "string") {
      errors.push("Password is required and must be a string");
    } else if (this.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

module.exports = LoginRequestDTO;
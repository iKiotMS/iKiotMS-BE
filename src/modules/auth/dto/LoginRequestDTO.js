class LoginRequestDTO {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }

  validate() {
    const errors = [];

    if (!this.email || typeof this.email !== "string") {
      errors.push("Email is required and must be a string");
    } else if (!this.email.includes("@")) {
      errors.push("Email must be valid");
    }

    if (!this.password || typeof this.password !== "string") {
      errors.push("Password is required and must be a string");
    } else if (this.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = LoginRequestDTO;

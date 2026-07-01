class RegisterRequestDTO {
  constructor(
    email,
    phoneNumber,
    password,
    firstName,
    lastName,
    tenantName,
    tenantPhoneNumber,
    tenantMainAddress,
    tenantTaxNumber,
    otpCode,
  ) {
    this.email = email;
    this.phoneNumber = phoneNumber;
    this.password = password;
    this.firstName = firstName;
    this.lastName = lastName;
    this.tenantName = tenantName;
    this.tenantPhoneNumber = tenantPhoneNumber;
    this.tenantMainAddress = tenantMainAddress;
    this.tenantTaxNumber = tenantTaxNumber;
    // The 6-digit OTP the user received via eSMS SMS. May be empty/"DEV_BYPASS"
    // in dev (OTP bypass); verified against Redis by the service in production.
    this.otpCode = otpCode;
  }

  validate() {
    const errors = [];

    // Validate phoneNumber
    if (!this.phoneNumber) {
      errors.push("Phone number is required and must be a string");
    } else if (this.phoneNumber.trim().length < 10) {
      errors.push("Phone number must be valid");
    }

    // Validate password
    if (!this.password || typeof this.password !== "string") {
      errors.push("Password is required and must be a string");
    } else if (this.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }

    // Validate tenant name
    if (!this.tenantName || typeof this.tenantName !== "string") {
      errors.push("Tenant name is required and must be a string");
    }

    // Validate names (optional but good practice)
    if (this.firstName !== undefined && typeof this.firstName !== "string") {
      errors.push("First name must be a string");
    }

    if (this.lastName !== undefined && typeof this.lastName !== "string") {
      errors.push("Last name must be a string");
    }

    if (
      this.tenantPhoneNumber !== undefined &&
      typeof this.tenantPhoneNumber !== "string"
    ) {
      errors.push("Tenant phone number must be a string");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

module.exports = RegisterRequestDTO;

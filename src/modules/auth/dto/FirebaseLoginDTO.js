const VALID_PLATFORMS = ["web", "mobile"];

/**
 * Validates a Google (Firebase) sign-in request.
 *
 * The client authenticates with Google through Firebase on its side, then
 * sends the resulting Firebase ID token here. The backend verifies it with
 * firebase-admin and matches the token's email against an existing user.
 *
 * `platform` decides the role gate: the mobile app is employee-only
 * (STAFF_ROLES), while the web dashboard allows every non-customer role.
 */
class FirebaseLoginDTO {
  constructor(idToken, platform) {
    this.idToken = idToken;
    // Default to "web" so an omitted platform gets the less-restrictive gate.
    this.platform = platform || "web";
  }

  validate() {
    const errors = [];

    if (!this.idToken || typeof this.idToken !== "string") {
      errors.push("idToken is required and must be a string");
    }

    if (!VALID_PLATFORMS.includes(this.platform)) {
      errors.push('platform must be either "web" or "mobile"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = FirebaseLoginDTO;

const { admin, getFirebaseApp } = require("../config/firebase");

/**
 * Verifies a phone number that was authenticated client-side via Firebase
 * Phone Authentication.
 *
 * Flow: the frontend uses the Firebase JS SDK to send + verify the SMS OTP,
 * then receives a Firebase ID token. That token is forwarded to the backend,
 * which only trusts the verified `phone_number` claim inside it.
 *
 * Dev bypass: when NODE_ENV is not "production", a missing token or the
 * sentinel value (DEV_OTP_BYPASS_TOKEN, default "DEV_BYPASS") skips Firebase
 * verification so OTP can be mocked locally without sending real SMS.
 */
class FirebaseAuthService {
  isDevBypass(idToken) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    const sentinel = process.env.DEV_OTP_BYPASS_TOKEN || "DEV_BYPASS";
    return !idToken || idToken === sentinel;
  }

  /**
   * @param {string} idToken Firebase ID token from the client.
   * @returns {Promise<{ phoneNumber: string|null, bypass: boolean }>}
   *   `bypass: true` means verification was skipped (dev) and the caller should
   *   trust the phone number supplied in the request body.
   */
  async verifyPhoneToken(idToken) {
    if (this.isDevBypass(idToken)) {
      return { phoneNumber: null, bypass: true };
    }

    const app = getFirebaseApp();
    if (!app) {
      throw new Error("Phone verification is not available (Firebase not configured)");
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      throw new Error("Invalid or expired phone verification token");
    }

    if (!decoded.phone_number) {
      throw new Error("Verification token does not contain a verified phone number");
    }

    return { phoneNumber: decoded.phone_number, bypass: false };
  }
}

/**
 * Normalize a Vietnamese phone number to E.164 (+84...) so a number entered as
 * "0912345678" matches the "+84912345678" returned by Firebase.
 */
function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("84")) return "+" + p;
  if (p.startsWith("0")) return "+84" + p.slice(1);
  return "+" + p;
}

module.exports = new FirebaseAuthService();
module.exports.normalizePhone = normalizePhone;

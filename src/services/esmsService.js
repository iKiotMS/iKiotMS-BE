const crypto = require("crypto");

// eSMS SendMultipleMessage V4 (JSON) endpoint.
const ESMS_ENDPOINT =
  "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/";

/** True when the eSMS credentials are present in the environment. */
function isConfigured() {
  return Boolean(process.env.ESMS_API_KEY && process.env.ESMS_SECRET_KEY);
}

/** Convert any VN phone form (+84…, 84…, 0…) to the local 0-prefixed form eSMS expects. */
function toLocalVN(phone) {
  let p = String(phone || "").trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+84")) return "0" + p.slice(3);
  if (p.startsWith("84")) return "0" + p.slice(2);
  return p;
}

/**
 * Build the OTP message body. eSMS brandname SMS must match an approved
 * template, so keep the wording stable and only swap the code + brandname.
 */
function buildContent(code) {
  const brandname = process.env.ESMS_BRANDNAME || "Baotrixemay";
  return `${code} la ma xac minh dang ky ${brandname} cua ban`;
}

/**
 * Send an OTP SMS via eSMS. Throws on any non-success CodeResult.
 * @param {string} phone Local VN phone (0xxxxxxxxx)
 * @param {string} code  6-digit OTP
 */
async function sendOtpSms(phone, code) {
  const payload = {
    ApiKey: process.env.ESMS_API_KEY,
    SecretKey: process.env.ESMS_SECRET_KEY,
    Phone: toLocalVN(phone),
    Content: buildContent(code),
    Brandname: process.env.ESMS_BRANDNAME || "Baotrixemay",
    SmsType: "2",
    IsUnicode: "0",
    RequestId: crypto.randomUUID(),
  };

  const res = await fetch(ESMS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  // eSMS returns CodeResult "100" on success; anything else is a failure.
  if (!res.ok || String(data.CodeResult) !== "100") {
    const err = new Error(
      `eSMS send failed (CodeResult=${data.CodeResult ?? "?"}${
        data.ErrorMessage ? `: ${data.ErrorMessage}` : ""
      })`,
    );
    err.esms = data;
    throw err;
  }

  return { smsId: data.SMSID, raw: data };
}

module.exports = { sendOtpSms, isConfigured, buildContent, toLocalVN, ESMS_ENDPOINT };

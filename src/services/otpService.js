const crypto = require("crypto");
const redisClient = require("../config/redis");
const esmsService = require("./esmsService");
const { normalizePhone } = require("./firebaseAuthService");

const OTP_TTL_SECONDS = 5 * 60;

// In-memory fallback used only when Redis is unavailable (keeps dev working
// even if the Redis instance is down). Not suitable for multi-instance prod.
const memStore = new Map(); // key -> { code, expiresAt }

function keyFor(phone) {
  return `otp:register:${normalizePhone(phone)}`;
}

function redisReady() {
  return Boolean(redisClient && redisClient.isReady);
}

async function storeCode(phone, code) {
  const key = keyFor(phone);
  if (redisReady()) {
    await redisClient.set(key, code, { EX: OTP_TTL_SECONDS });
  } else {
    memStore.set(key, { code, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
  }
}

async function readCode(phone) {
  const key = keyFor(phone);
  if (redisReady()) {
    return redisClient.get(key);
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.code;
}

async function clearCode(phone) {
  const key = keyFor(phone);
  if (redisReady()) {
    await redisClient.del(key);
  } else {
    memStore.delete(key);
  }
}

/** In dev, an empty code or the sentinel token skips OTP verification. */
function isDevBypass(code) {
  if (process.env.NODE_ENV === "production") return false;
  const sentinel = process.env.DEV_OTP_BYPASS_TOKEN || "DEV_BYPASS";
  return !code || code === sentinel;
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

/**
 * Generate + store an OTP for the given phone and dispatch it via eSMS.
 * When eSMS is not configured in dev, the code is logged to the console
 * instead of sending a real SMS (so you can test without spending credit).
 */
async function sendOtp(phoneNumber) {
  if (!phoneNumber) throw new Error("Phone number is required");

  const code = generateCode();
  await storeCode(phoneNumber, code);

  if (esmsService.isConfigured()) {
    await esmsService.sendOtpSms(phoneNumber, code);
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`📱 [DEV OTP] ${normalizePhone(phoneNumber)} -> ${code}`);
  } else {
    throw new Error("SMS service is not configured");
  }

  return { sent: true };
}

/**
 * Verify a submitted OTP against the stored value. Consumes it on success.
 * Throws a descriptive Error when invalid/expired.
 */
async function verifyOtp(phoneNumber, code) {
  if (isDevBypass(code)) return true;

  const stored = await readCode(phoneNumber);
  if (!stored) {
    throw new Error("OTP has expired or was not requested. Please request a new code.");
  }
  if (String(code).trim() !== String(stored)) {
    throw new Error("Invalid OTP code");
  }

  await clearCode(phoneNumber);
  return true;
}

module.exports = { sendOtp, verifyOtp, generateCode };

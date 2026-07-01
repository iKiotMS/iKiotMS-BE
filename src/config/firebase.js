const admin = require("firebase-admin");

let firebaseApp = null;
let initAttempted = false;

/**
 * Lazily initialize the Firebase Admin SDK from environment variables.
 *
 * Credentials are read from:
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_CLIENT_EMAIL
 *   - FIREBASE_PRIVATE_KEY  (escaped newlines `\n` are converted to real newlines)
 *
 * Returns the initialized admin app, or null when credentials are missing.
 * Never throws on startup so the server can boot without Firebase configured
 * (useful for local dev where OTP is bypassed).
 */
function getFirebaseApp() {
  if (initAttempted) {
    return firebaseApp;
  }
  initAttempted = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "⚠ Firebase Admin not configured (missing FIREBASE_* env vars). Phone OTP verification is disabled.",
    );
    return null;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      // .env stores the key on a single line with literal \n sequences
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  console.log("✓ Firebase Admin initialized");
  return firebaseApp;
}

function isFirebaseConfigured() {
  return getFirebaseApp() !== null;
}

module.exports = { admin, getFirebaseApp, isFirebaseConfigured };

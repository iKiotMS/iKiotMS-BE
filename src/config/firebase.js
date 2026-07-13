const admin = require("firebase-admin");

let firebaseApp = null;
let initAttempted = false;

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

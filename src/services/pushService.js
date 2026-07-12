const { admin, getFirebaseApp } = require("../config/firebase");
const { User } = require("../models");

/**
 * Send an FCM push to a set of users.
 *
 * Degrades gracefully, like the rest of the optional integrations here: if
 * Firebase has no credentials, or nobody has registered a device, this logs and
 * returns instead of throwing. Push is a side-channel — a failed notification
 * must never fail the business operation that triggered it.
 *
 * @param {string[]} userIds
 * @param {{ title: string, body: string, data?: Record<string, string>, link?: string }} payload
 */
const sendToUsers = async (userIds, { title, body, data = {}, link } = {}) => {
  if (!getFirebaseApp()) {
    console.warn("[pushService] Skipped: Firebase Admin is not configured");
    return { sent: 0, failed: 0 };
  }

  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  if (ids.length === 0) return { sent: 0, failed: 0 };

  const users = await User.find({ _id: { $in: ids } })
    .select("fcmTokens")
    .lean();

  const tokens = users.flatMap((user) =>
    (user.fcmTokens || []).map((entry) => entry.token),
  );

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // FCM data payload values must all be strings.
  const stringifiedData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)]),
  );

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: stringifiedData,
    webpush: {
      fcmOptions: link ? { link } : undefined,
    },
  });

  await pruneDeadTokens(tokens, response.responses);

  return { sent: response.successCount, failed: response.failureCount };
};

/**
 * Drop tokens FCM tells us no longer exist, so they don't accumulate forever.
 * Only these two error codes mean "this token is permanently dead" — anything
 * else (rate limits, transient server errors) is retried on the next send.
 */
const pruneDeadTokens = async (tokens, responses) => {
  const dead = tokens.filter((_token, index) => {
    const code = responses[index]?.error?.code;
    return (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    );
  });

  if (dead.length === 0) return;

  await User.updateMany(
    { "fcmTokens.token": { $in: dead } },
    { $pull: { fcmTokens: { token: { $in: dead } } } },
  );

  console.log(`[pushService] Pruned ${dead.length} dead FCM token(s)`);
};

module.exports = { sendToUsers };

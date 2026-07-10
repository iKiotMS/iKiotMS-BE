// Populated User docs carry no flat `name` — the name lives in profile.firstName /
// profile.lastName. Consumers across the app read `userId.name`, so after populating a
// user (with .lean(), which disables virtuals) call this to attach a display `name`.
// Mutates and returns the plain doc. Safe on null / string (unpopulated) values.
const USER_NAME_SELECT = "profile.firstName profile.lastName email role phoneNumber";

function attachUserName(userDoc) {
  if (!userDoc || typeof userDoc !== "object") return userDoc;
  const { firstName = "", lastName = "" } = userDoc.profile || {};
  userDoc.name = `${firstName} ${lastName}`.trim();
  return userDoc;
}

module.exports = { attachUserName, USER_NAME_SELECT };

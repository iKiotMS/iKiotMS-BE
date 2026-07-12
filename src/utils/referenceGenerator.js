const crypto = require("crypto");

// One generator for every reference code — pass a prefix from REFERENCE_PREFIX.
// 5 random bytes (2^40) keeps birthday collisions negligible even against
// Order.paymentReference's GLOBAL unique index across all tenants; a collision there
// would abort the checkout transaction, so don't lower this without reason.
function generateReference(prefix, byteLength = 5) {
  return prefix + crypto.randomBytes(byteLength).toString("hex").toUpperCase();
}

// Anchored regex to find/filter references of a given flow, e.g. referenceMatcher("ORD")
// -> /^ORD/i. Used by webhook extraction and stats prefix filtering.
function referenceMatcher(prefix) {
  return new RegExp("^" + prefix, "i");
}

module.exports = { generateReference, referenceMatcher };

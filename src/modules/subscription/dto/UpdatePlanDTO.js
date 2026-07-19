const { PLAN_FEATURES } = require("../../../constants/planFeatures");

const VALID_FEATURES = Object.values(PLAN_FEATURES);

// Fields an admin may edit. planCode and billingCycle are intentionally
// excluded: they are stable keys the FE tier logic (TRIAL/PLUS/PRO + _YEARLY)
// and the upgrade flow depend on.
const EDITABLE_FIELDS = [
  "planName",
  "description",
  "displayFeatures",
  "price",
  "maxBranches",
  "maxUsers",
  "maxProducts",
  "trialDays",
  "features",
  "isPopular",
  "isActive",
];

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Partial-update DTO for a subscription Plan. Only fields present in the
 * request body are validated and applied, so callers can PATCH a subset.
 */
class UpdatePlanDTO {
  constructor(data = {}) {
    for (const field of EDITABLE_FIELDS) {
      if (data[field] !== undefined) this[field] = data[field];
    }
  }

  validate() {
    const errors = [];

    if ("planName" in this) {
      if (typeof this.planName !== "string" || !this.planName.trim()) {
        errors.push("planName must be a non-empty string");
      }
    }

    if ("description" in this && typeof this.description !== "string") {
      errors.push("description must be a string");
    }

    if ("displayFeatures" in this) {
      if (
        !Array.isArray(this.displayFeatures) ||
        this.displayFeatures.some((f) => typeof f !== "string")
      ) {
        errors.push("displayFeatures must be an array of strings");
      }
    }

    if ("price" in this) {
      if (!isFiniteNumber(this.price) || this.price < 0) {
        errors.push("price must be a number >= 0");
      }
    }

    for (const key of ["maxBranches", "maxUsers", "maxProducts"]) {
      if (key in this) {
        // -1 means unlimited; anything below that is invalid
        if (!isFiniteNumber(this[key]) || this[key] < -1) {
          errors.push(`${key} must be a number >= -1 (-1 = unlimited)`);
        }
      }
    }

    if ("trialDays" in this) {
      if (!isFiniteNumber(this.trialDays) || this.trialDays < 0) {
        errors.push("trialDays must be a number >= 0");
      }
    }

    if ("features" in this) {
      if (!Array.isArray(this.features)) {
        errors.push("features must be an array");
      } else {
        const invalid = this.features.filter((f) => !VALID_FEATURES.includes(f));
        if (invalid.length) {
          errors.push(`Unknown feature(s): ${invalid.join(", ")}`);
        }
      }
    }

    if ("isPopular" in this && typeof this.isPopular !== "boolean") {
      errors.push("isPopular must be a boolean");
    }

    if ("isActive" in this && typeof this.isActive !== "boolean") {
      errors.push("isActive must be a boolean");
    }

    return { isValid: errors.length === 0, errors };
  }

  // Only the fields the caller actually provided, ready for $set.
  toPayload() {
    const payload = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in this) payload[field] = this[field];
    }
    return payload;
  }
}

module.exports = UpdatePlanDTO;

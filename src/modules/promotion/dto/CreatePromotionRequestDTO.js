const DISCOUNT_TYPES = ["PERCENT", "FIXED_AMOUNT"];
const RULE_TYPES = ["all", "category", "product"];

class CreatePromotionRequestDTO {
  constructor(data = {}) {
    // Empty array = applies tenant-wide. Non-empty = only at these branches.
    this.branchIds = Array.isArray(data.branchIds) ? data.branchIds : [];
    this.promoName = data.promoName;
    this.description = data.description;
    this.discountType = data.discountType;
    this.discountValue = data.discountValue;
    this.maxDiscountAmount =
      data.maxDiscountAmount === undefined ? null : data.maxDiscountAmount;
    this.minOrderValue = data.minOrderValue || 0;
    this.applicableRule = data.applicableRule || { type: "all" };
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.priority = data.priority || 0;
    this.stackable = Boolean(data.stackable);
    this.usageLimit = data.usageLimit === undefined ? null : data.usageLimit;
    this.usageLimitPerCustomer =
      data.usageLimitPerCustomer === undefined ? null : data.usageLimitPerCustomer;
  }

  validate() {
    const errors = [];

    if (!this.promoName || typeof this.promoName !== "string" || this.promoName.trim() === "") {
      errors.push("Promotion name is required and must be a non-empty string");
    }

    if (!DISCOUNT_TYPES.includes(this.discountType)) {
      errors.push(`discountType is required and must be one of: ${DISCOUNT_TYPES.join(", ")}`);
    } else if (this.discountValue === undefined || this.discountValue === null || Number(this.discountValue) <= 0) {
      errors.push("discountValue is required and must be greater than 0");
    } else if (this.discountType === "PERCENT" && Number(this.discountValue) > 100) {
      errors.push("discountValue cannot exceed 100 when discountType is PERCENT");
    }

    if (this.maxDiscountAmount !== null) {
      if (Number(this.maxDiscountAmount) <= 0) {
        errors.push("maxDiscountAmount must be greater than 0");
      }
      if (this.discountType !== "PERCENT") {
        errors.push("maxDiscountAmount is only applicable when discountType is PERCENT");
      }
    }

    if (this.minOrderValue < 0) {
      errors.push("minOrderValue cannot be negative");
    }

    if (this.branchIds.some((id) => typeof id !== "string" || !id.trim())) {
      errors.push("branchIds must contain only non-empty branch ID strings");
    }

    if (!this.applicableRule || !RULE_TYPES.includes(this.applicableRule.type)) {
      errors.push(`applicableRule.type is required and must be one of: ${RULE_TYPES.join(", ")}`);
    } else if (this.applicableRule.type === "category") {
      if (!Array.isArray(this.applicableRule.categoryIds) || this.applicableRule.categoryIds.length === 0) {
        errors.push("applicableRule.categoryIds must be a non-empty array when type is 'category'");
      }
    } else if (this.applicableRule.type === "product") {
      if (!Array.isArray(this.applicableRule.productItemIds) || this.applicableRule.productItemIds.length === 0) {
        errors.push("applicableRule.productItemIds must be a non-empty array when type is 'product'");
      }
    }

    if (!this.startDate || Number.isNaN(new Date(this.startDate).getTime())) {
      errors.push("startDate is required and must be a valid date");
    }
    if (!this.endDate || Number.isNaN(new Date(this.endDate).getTime())) {
      errors.push("endDate is required and must be a valid date");
    }
    if (this.startDate && this.endDate && new Date(this.endDate) <= new Date(this.startDate)) {
      errors.push("endDate must be after startDate");
    }

    if (this.priority !== undefined && (!Number.isInteger(this.priority) || this.priority < 0)) {
      errors.push("priority must be a non-negative integer");
    }

    if (this.usageLimit !== null && (!Number.isInteger(this.usageLimit) || this.usageLimit < 1)) {
      errors.push("usageLimit must be an integer of at least 1 when provided");
    }
    if (
      this.usageLimitPerCustomer !== null &&
      (!Number.isInteger(this.usageLimitPerCustomer) || this.usageLimitPerCustomer < 1)
    ) {
      errors.push("usageLimitPerCustomer must be an integer of at least 1 when provided");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = CreatePromotionRequestDTO;

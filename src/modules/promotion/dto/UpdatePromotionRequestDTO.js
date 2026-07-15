const DISCOUNT_TYPES = ["PERCENT", "FIXED_AMOUNT"];
const RULE_TYPES = ["all", "category", "product"];
const STATUSES = ["ACTIVE", "INACTIVE"];

class UpdatePromotionRequestDTO {
  constructor(data = {}) {
    if (data.branchIds !== undefined) {
      this.branchIds = Array.isArray(data.branchIds) ? data.branchIds : [];
    }
    if (data.promoName !== undefined) this.promoName = data.promoName;
    if (data.description !== undefined) this.description = data.description;
    if (data.discountType !== undefined) this.discountType = data.discountType;
    if (data.discountValue !== undefined) this.discountValue = data.discountValue;
    if (data.maxDiscountAmount !== undefined) this.maxDiscountAmount = data.maxDiscountAmount;
    if (data.minOrderValue !== undefined) this.minOrderValue = data.minOrderValue;
    if (data.applicableRule !== undefined) this.applicableRule = data.applicableRule;
    if (data.startDate !== undefined) this.startDate = data.startDate;
    if (data.endDate !== undefined) this.endDate = data.endDate;
    if (data.priority !== undefined) this.priority = data.priority;
    if (data.stackable !== undefined) this.stackable = Boolean(data.stackable);
    if (data.usageLimit !== undefined) this.usageLimit = data.usageLimit;
    if (data.usageLimitPerCustomer !== undefined) this.usageLimitPerCustomer = data.usageLimitPerCustomer;
    if (data.status !== undefined) this.status = data.status;
  }

  validate() {
    const errors = [];

    if (this.promoName !== undefined && (typeof this.promoName !== "string" || this.promoName.trim() === "")) {
      errors.push("promoName must be a non-empty string");
    }

    if (this.discountType !== undefined && !DISCOUNT_TYPES.includes(this.discountType)) {
      errors.push(`discountType must be one of: ${DISCOUNT_TYPES.join(", ")}`);
    }

    if (this.discountValue !== undefined) {
      if (Number(this.discountValue) <= 0) {
        errors.push("discountValue must be greater than 0");
      } else if (this.discountType === "PERCENT" && Number(this.discountValue) > 100) {
        errors.push("discountValue cannot exceed 100 when discountType is PERCENT");
      }
    }

    if (this.maxDiscountAmount !== undefined && this.maxDiscountAmount !== null) {
      if (Number(this.maxDiscountAmount) <= 0) {
        errors.push("maxDiscountAmount must be greater than 0");
      }
      if (this.discountType && this.discountType !== "PERCENT") {
        errors.push("maxDiscountAmount is only applicable when discountType is PERCENT");
      }
    }

    if (this.minOrderValue !== undefined && this.minOrderValue < 0) {
      errors.push("minOrderValue cannot be negative");
    }

    if (
      this.branchIds !== undefined &&
      this.branchIds.some((id) => typeof id !== "string" || !id.trim())
    ) {
      errors.push("branchIds must contain only non-empty branch ID strings");
    }

    if (this.applicableRule !== undefined) {
      if (!RULE_TYPES.includes(this.applicableRule.type)) {
        errors.push(`applicableRule.type must be one of: ${RULE_TYPES.join(", ")}`);
      } else if (this.applicableRule.type === "category") {
        if (!Array.isArray(this.applicableRule.categoryIds) || this.applicableRule.categoryIds.length === 0) {
          errors.push("applicableRule.categoryIds must be a non-empty array when type is 'category'");
        }
      } else if (this.applicableRule.type === "product") {
        if (!Array.isArray(this.applicableRule.productItemIds) || this.applicableRule.productItemIds.length === 0) {
          errors.push("applicableRule.productItemIds must be a non-empty array when type is 'product'");
        }
      }
    }

    if (this.startDate !== undefined && Number.isNaN(new Date(this.startDate).getTime())) {
      errors.push("startDate must be a valid date");
    }
    if (this.endDate !== undefined && Number.isNaN(new Date(this.endDate).getTime())) {
      errors.push("endDate must be a valid date");
    }
    if (this.startDate !== undefined && this.endDate !== undefined && new Date(this.endDate) <= new Date(this.startDate)) {
      errors.push("endDate must be after startDate");
    }

    if (this.priority !== undefined && (!Number.isInteger(this.priority) || this.priority < 0)) {
      errors.push("priority must be a non-negative integer");
    }

    if (
      this.usageLimit !== undefined &&
      this.usageLimit !== null &&
      (!Number.isInteger(this.usageLimit) || this.usageLimit < 1)
    ) {
      errors.push("usageLimit must be an integer of at least 1 when provided");
    }
    if (
      this.usageLimitPerCustomer !== undefined &&
      this.usageLimitPerCustomer !== null &&
      (!Number.isInteger(this.usageLimitPerCustomer) || this.usageLimitPerCustomer < 1)
    ) {
      errors.push("usageLimitPerCustomer must be an integer of at least 1 when provided");
    }

    if (this.status !== undefined && !STATUSES.includes(this.status)) {
      errors.push(`Invalid status. Must be one of: ${STATUSES.join(", ")}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = UpdatePromotionRequestDTO;

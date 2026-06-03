class CreateSubscriptionDTO {
  constructor(tenantId, planId, startDate, endDate, trialEndDate, autoRenew = true) {
    this.tenantId = tenantId;
    this.planId = planId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.trialEndDate = trialEndDate;
    this.autoRenew = autoRenew;
  }

  validate() {
    const errors = [];

    if (!this.tenantId) {
      errors.push("Tenant ID is required");
    }

    if (!this.planId) {
      errors.push("Plan ID is required");
    }

    if (!this.startDate) {
      errors.push("Start date is required");
    } else if (!(this.startDate instanceof Date) || isNaN(this.startDate.getTime())) {
      errors.push("Start date must be a valid date");
    }

    if (!this.endDate) {
      errors.push("End date is required");
    } else if (!(this.endDate instanceof Date) || isNaN(this.endDate.getTime())) {
      errors.push("End date must be a valid date");
    }

    if (this.trialEndDate && (!(this.trialEndDate instanceof Date) || isNaN(this.trialEndDate.getTime()))) {
      errors.push("Trial end date must be a valid date");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

module.exports = CreateSubscriptionDTO;
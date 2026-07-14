const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED", "DELETED"];

class LeaveRequestPerDayQueryDTO {
  constructor(query = {}) {
    this.status = query.status?.trim() || undefined;
    this.keyword = query.keyword?.trim() || undefined;
    this.startDate = query.startDate || undefined;
    this.endDate = query.endDate || undefined;
  }

  validate() {
    const errors = {};
    if (this.status && !VALID_STATUSES.includes(this.status)) {
      errors.status = "Invalid leave request status";
    }
    if (this.startDate && Number.isNaN(new Date(this.startDate).getTime())) {
      errors.startDate = "Invalid start date";
    }
    if (this.endDate && Number.isNaN(new Date(this.endDate).getTime())) {
      errors.endDate = "Invalid end date";
    }
    if (!errors.startDate && !errors.endDate && this.startDate && this.endDate && new Date(this.startDate) > new Date(this.endDate)) {
      errors.endDate = "End date must be on or after start date";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = LeaveRequestPerDayQueryDTO;

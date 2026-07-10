class GeneratePreviewPayrollDTO {
  constructor(tenantId, data) {
    this.tenantId = tenantId;
    this.periodStartDate = data.periodStartDate;
    this.periodEndDate = data.periodEndDate;
    this.userIds = data.userIds;
  }

  validate() {
    const errors = {};

    if (!this.tenantId) {
      errors.tenantId = "yêu cầu tenantId";
    } else if (!mongoose.Types.ObjectId.isValid(this.tenantId)) {
      errors.tenantId = "tenantId không hợp lệ";
    }

    if (!this.periodStartDate) {
      errors.periodStartDate = "yêu cầu periodStartDate";
    } else if (isNaN(Date.parse(this.periodStartDate))) {
      errors.periodStartDate = "periodStartDate không hợp lệ";
    }

    if (!this.periodEndDate) {
      errors.periodEndDate = "yêu cầu periodEndDate";
    } else if (isNaN(Date.parse(this.periodEndDate))) {
      errors.periodEndDate = "periodEndDate không hợp lệ";
    }

    if (this.userIds && !Array.isArray(this.userIds)) {
      errors.userIds = "userIds phải là mảng";
    } else if (
      this.userIds &&
      !this.userIds.every((id) => mongoose.Types.ObjectId.isValid(id))
    ) {
      errors.userIds = "userIds chứa id không hợp lệ";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      statusCode: Object.keys(errors).length === 0 ? 200 : 400,
      error: errors,
    };
  }
}

module.exports = GeneratePreviewPayrollDTO;

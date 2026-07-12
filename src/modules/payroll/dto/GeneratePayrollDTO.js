const mongoose = require("mongoose");

class GeneratePayrollDTO {
  constructor(data) {
    this.payrollMonth = data.payrollMonth;
    this.userIds = data.userIds;
  }

  validate() {
    const errors = {};

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.payrollMonth || "")) {
      errors.payrollMonth = "Tháng lương phải có định dạng YYYY-MM";
    }

    if (this.userIds !== undefined && !Array.isArray(this.userIds)) {
      errors.userIds = "userIds phải là mảng";
    } else if (
      this.userIds?.some((userId) => !mongoose.Types.ObjectId.isValid(userId))
    ) {
      errors.userIds = "userIds chứa id không hợp lệ";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

module.exports = GeneratePayrollDTO;

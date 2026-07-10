const { updatePayrollSettingFields } = require("../../../constants/PayrollConstants");

class updatePayrollSettingDTO {
  constructor(data){
    this.cycle = data.cycle;
    this.periodStartDay = Number(data.periodStartDay) ?? undefined;
    this.approveAfterPeriodEndDays = Number(data.approveAfterPeriodEndDays);
    this.payAfterPeriodEndDays = Number(data.payAfterPeriodEndDays);
    this.autoGenerate = data.autoGenerate || false;
    this.status = data.status;
  }
   validate() {
    const errors = {};

    if (this.cycle !== undefined && this.cycle !== "MONTHLY") {
      errors.cycle = "Chu kỳ lương phải là MONTHLY";
    }

    if (
      this.periodStartDay !== undefined &&
      (!Number.isInteger(this.periodStartDay) ||
        this.periodStartDay < 1 ||
        this.periodStartDay > 28)
    ) {
      errors.periodStartDay = "Ngày bắt đầu kỳ lương phải từ 1 đến 28";
    }

    if (
      this.approveAfterPeriodEndDays !== undefined &&
      (!Number.isInteger(this.approveAfterPeriodEndDays) ||
        this.approveAfterPeriodEndDays < 0)
    ) {
      errors.approveAfterPeriodEndDays =
        "Số ngày chờ duyệt lương phải là số nguyên không âm";
    }

    if (
      this.payAfterPeriodEndDays !== undefined &&
      (!Number.isInteger(this.payAfterPeriodEndDays) ||
        this.payAfterPeriodEndDays < 0)
    ) {
      errors.payAfterPeriodEndDays =
        "Số ngày chờ trả lương phải là số nguyên không âm";
    }

    if (
      this.autoGenerate !== undefined &&
      typeof this.autoGenerate !== "boolean"
    ) {
      errors.autoGenerate = "Tự động tạo bảng lương phải là boolean";
    }

    if (
      this.status !== undefined &&
      !["ACTIVE", "INACTIVE"].includes(this.status)
    ) {
      errors.status = "Trạng thái cấu hình lương không hợp lệ";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      statusCode: Object.keys(errors).length === 0 ? 200 : 400,
      errors,
    };
  }

  toObject() {
    const updateData ={};

    updatePayrollSettingFields.forEach((field) => {
      if(this[field] !== undefined)
        updateData[field] = this[field];
    })

    return updateData;
  }
}
module.exports = updatePayrollSettingDTO;
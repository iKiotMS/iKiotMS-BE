const mongoose = require("mongoose");
const { PayrollCycle } = require("../../../constants/PayrollConstants");

class createPayrollSettingDTO {
  constructor(tenantId, data) {
    this.tenantId = tenantId;
    this.cycle = data.cycle;
    this.periodStartDay = Number(data.periodStartDay) ?? undefined;
    this.approveAfterPeriodEndDays = Number(data.approveAfterPeriodEndDays);
    this.payAfterPeriodEndDays = Number(data.payAfterPeriodEndDays);
    this.autoGenerate = data.autoGenerate || false;
    this.status = "ACTIVE";
  }

  validate() {
    const error = {};
    if (!this.tenantId) {
      error.tenantId = "yêu cầu tenantId";
    } else if (!mongoose.Types.ObjectId.isValid(this.tenantId)) {
      error.tenantId = "tenantId không hợp lệ";
    }

    if (PayrollCycle.includes(this.cycle) === false) {
      error.cycle = "Chu kỳ lương phải thuộc: " + PayrollCycle.join(", ");
    }

    if (
      !Number.isInteger(this.periodStartDay) ||
      this.periodStartDay < 1 ||
      this.periodStartDay > 28
    ) {
      error.periodStartDay = "Ngày bắt đầu kỳ lương phải từ 1 đến 28";
    }

    if (
      !Number.isInteger(this.approveAfterPeriodEndDays) ||
      this.approveAfterPeriodEndDays < 0
    ) {
      error.approveAfterPeriodEndDays = "Số ngày chờ duyệt không được âm";
    }

    if (
      !Number.isInteger(this.payAfterPeriodEndDays) ||
      this.payAfterPeriodEndDays < 0
    ) {
      error.payAfterPeriodEndDays = "Số ngày chờ trả lương không được âm";
    }

    if (typeof this.autoGenerate !== "boolean") {
      error.autoGenerate = "Tự động tạo bảng lương phải là boolean";
    }

    return {
      isValid: Object.keys(error).length === 0,
      statusCode: Object.keys(error).length === 0 ? 200 : 400,
      error: error,
    };
  }

  toObject() {
    return {
      tenantId: this.tenantId,
      cycle: this.cycle,
      periodStartDay: this.periodStartDay,
      approveAfterPeriodEndDays: this.approveAfterPeriodEndDays,
      payAfterPeriodEndDays: this.payAfterPeriodEndDays,
      autoGenerate: this.autoGenerate,
      status: this.status,
    };
  }
}
module.exports = createPayrollSettingDTO;

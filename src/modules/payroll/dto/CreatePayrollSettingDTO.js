const mongoose = require("mongoose");
const { PayrollCycle } = require("../../../constants/PayrollConstants");

class createPayrollSettingDTO {
  constructor(tenantId, data) {
    this.tenantId = tenantId;
    this.cycle = data.cycle;
    this.periodStartDay = Number(data.periodStartDay);
    this.approveAfterPeriodEndDays = Number(data.approveAfterPeriodEndDays);
    this.payAfterPeriodEndDays = Number(data.payAfterPeriodEndDays);
    this.autoGenerate = data.autoGenerate ?? false;
    this.standardWorkingDays =
      data.standardWorkingDays === undefined
        ? 26
        : Number(data.standardWorkingDays);
    this.standardWorkingHoursPerDay =
      data.standardWorkingHoursPerDay === undefined
        ? 8
        : Number(data.standardWorkingHoursPerDay);
    this.weekendDays = data.weekendDays === undefined ? [0] : data.weekendDays;
    this.lateGraceMinutes =
      data.lateGraceMinutes === undefined ? 15 : Number(data.lateGraceMinutes);
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

    if (
      !Number.isInteger(this.standardWorkingDays) ||
      this.standardWorkingDays < 1 ||
      this.standardWorkingDays > 31
    ) {
      error.standardWorkingDays = "Số ngày công chuẩn phải từ 1 đến 31";
    }

    if (
      !Number.isFinite(this.standardWorkingHoursPerDay) ||
      this.standardWorkingHoursPerDay < 1 ||
      this.standardWorkingHoursPerDay > 24
    ) {
      error.standardWorkingHoursPerDay = "Số giờ công chuẩn phải từ 1 đến 24";
    }

    if (
      !Array.isArray(this.weekendDays) ||
      this.weekendDays.length === 0 ||
      this.weekendDays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    ) {
      error.weekendDays = "Ngày cuối tuần phải là mảng số nguyên từ 0 đến 6";
    }

    if (!Number.isInteger(this.lateGraceMinutes) || this.lateGraceMinutes < 0) {
      error.lateGraceMinutes = "Số phút được phép đi muộn phải là số nguyên không âm";
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
      standardWorkingDays: this.standardWorkingDays,
      standardWorkingHoursPerDay: this.standardWorkingHoursPerDay,
      weekendDays: this.weekendDays,
      lateGraceMinutes: this.lateGraceMinutes,
      status: this.status,
    };
  }
}
module.exports = createPayrollSettingDTO;

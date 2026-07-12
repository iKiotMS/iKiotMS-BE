const { updatePayrollSettingFields } = require("../../../constants/PayrollConstants");

class updatePayrollSettingDTO {
  constructor(data) {
    this.cycle = data.cycle;
    this.periodStartDay =
      data.periodStartDay === undefined
        ? undefined
        : Number(data.periodStartDay);
    this.approveAfterPeriodEndDays =
      data.approveAfterPeriodEndDays === undefined
        ? undefined
        : Number(data.approveAfterPeriodEndDays);
    this.payAfterPeriodEndDays =
      data.payAfterPeriodEndDays === undefined
        ? undefined
        : Number(data.payAfterPeriodEndDays);
    this.autoGenerate = data.autoGenerate;
    this.standardWorkingDays =
      data.standardWorkingDays === undefined
        ? undefined
        : Number(data.standardWorkingDays);
    this.standardWorkingHoursPerDay =
      data.standardWorkingHoursPerDay === undefined
        ? undefined
        : Number(data.standardWorkingHoursPerDay);
    this.weekendDays = data.weekendDays;
    this.lateGraceMinutes =
      data.lateGraceMinutes === undefined
        ? undefined
        : Number(data.lateGraceMinutes);
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

    if (
      this.standardWorkingDays !== undefined &&
      (!Number.isInteger(this.standardWorkingDays) ||
        this.standardWorkingDays < 1 ||
        this.standardWorkingDays > 31)
    ) {
      errors.standardWorkingDays = "Số ngày công chuẩn phải từ 1 đến 31";
    }

    if (
      this.standardWorkingHoursPerDay !== undefined &&
      (!Number.isFinite(this.standardWorkingHoursPerDay) ||
        this.standardWorkingHoursPerDay < 1 ||
        this.standardWorkingHoursPerDay > 24)
    ) {
      errors.standardWorkingHoursPerDay = "Số giờ công chuẩn phải từ 1 đến 24";
    }

    if (
      this.weekendDays !== undefined &&
      (!Array.isArray(this.weekendDays) ||
        this.weekendDays.length === 0 ||
        this.weekendDays.some(
          (day) => !Number.isInteger(day) || day < 0 || day > 6,
        ))
    ) {
      errors.weekendDays = "Ngày cuối tuần phải là mảng số nguyên từ 0 đến 6";
    }

    if (
      this.lateGraceMinutes !== undefined &&
      (!Number.isInteger(this.lateGraceMinutes) || this.lateGraceMinutes < 0)
    ) {
      errors.lateGraceMinutes = "Số phút được phép đi muộn phải là số nguyên không âm";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      statusCode: Object.keys(errors).length === 0 ? 200 : 400,
      errors,
    };
  }

  toObject() {
    const updateData = {};

    updatePayrollSettingFields.forEach((field) => {
      if (this[field] !== undefined) updateData[field] = this[field];
    });

    return updateData;
  }
}
module.exports = updatePayrollSettingDTO;

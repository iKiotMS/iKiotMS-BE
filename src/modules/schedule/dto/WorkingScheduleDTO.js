const isValidDateString = (value) => {
  if (!value || typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

class BulkWorkingScheduleDTO {
  constructor(tenantId, createdBy, data = {}) {
    data = data || {};

    this.tenantId = tenantId;
    this.createdBy = createdBy;
    this.schedules = Array.isArray(data.schedules)
      ? data.schedules.map((schedule) => ({
          userId: schedule.userId,
          shiftTemplateId: schedule.shiftTemplateId,
          workDate: schedule.workDate,
        }))
      : null;
  }

  validate() {
    const errors = [];

    if (!this.tenantId) {
      errors.push("Thiếu thông tin tenant");
    }

    if (!Array.isArray(this.schedules)) {
      errors.push("Danh sách phân ca phải là một mảng");
    } else if (this.schedules.length === 0) {
      errors.push("Cần ít nhất một bản ghi phân ca");
    } else {
      this.schedules.forEach((schedule, index) => {
        const prefix = `Phân ca ${index + 1}`;

        if (!schedule.userId) {
          errors.push(`${prefix}: thiếu nhân viên`);
        }

        if (!schedule.shiftTemplateId) {
          errors.push(`${prefix}: thiếu ca mẫu`);
        }

        if (!isValidDateString(schedule.workDate)) {
          errors.push(`${prefix}: ngày làm việc không hợp lệ`);
        }
      });
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      statusCode: isValid ? 200 : 400,
      errors,
    };
  }
}

module.exports = { BulkWorkingScheduleDTO };

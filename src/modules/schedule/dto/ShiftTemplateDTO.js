const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

class ShiftTemplateDTO {
  constructor(tenantId, data = {}) {
    data = data || {};

    this.tenantId = tenantId;
    this.name = data.name?.trim();
    this.startTime = data.startTime?.trim();
    this.endTime = data.endTime?.trim();
  }

  validate() {
    const errors = [];

    if (!this.tenantId) {
      errors.push("Thiếu thông tin tenant");
    }

    if (!this.name) {
      errors.push("Tên ca mẫu là bắt buộc");
    }

    if (!this.startTime || !TIME_PATTERN.test(this.startTime)) {
      errors.push("Giờ bắt đầu phải có định dạng HH:mm");
    }

    if (!this.endTime || !TIME_PATTERN.test(this.endTime)) {
      errors.push("Giờ kết thúc phải có định dạng HH:mm");
    }

    // if (
    //   this.startTime &&
    //   this.endTime &&
    //   TIME_PATTERN.test(this.startTime) &&
    //   TIME_PATTERN.test(this.endTime) &&
    //   this.startTime >= this.endTime
    // ) {
    //   errors.push("Giờ kết thúc phải sau giờ bắt đầu");
    // } --- IGNORE END TIME MUST BE AFTER START TIME ---

    const isValid = errors.length === 0;

    return {
      isValid,
      statusCode: isValid ? 200 : 400,
      errors,
    };
  }

  toObject() {
    return {
      tenantId: this.tenantId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
    };
  }
}

module.exports = { ShiftTemplateDTO };

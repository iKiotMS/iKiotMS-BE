const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function isValidDateText(value) {
  if (!DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

class CreateHolidayDTO {
  constructor(data) {
    this.date = data.date;
    this.name = data.name;
    this.isActive = data.isActive ?? true;
  }

  validate() {
    const errors = {};
    if (!isValidDateText(this.date)) {
      errors.date = "Ngày lễ phải có định dạng YYYY-MM-DD và là ngày hợp lệ";
    }
    if (!this.name?.trim()) errors.name = "Tên ngày lễ là bắt buộc";
    if (typeof this.isActive !== "boolean") {
      errors.isActive = "isActive phải là boolean";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

class UpdateHolidayDTO {
  constructor(data) {
    this.date = data.date;
    this.name = data.name;
    this.hasIsActive = data.isActive !== undefined;
  }

  validate() {
    const errors = {};
    if (this.date !== undefined && !isValidDateText(this.date)) {
      errors.date = "Ngày lễ phải có định dạng YYYY-MM-DD và là ngày hợp lệ";
    }
    if (this.name !== undefined && !this.name?.trim()) {
      errors.name = "Tên ngày lễ không được để trống";
    }
    if (this.hasIsActive) {
      errors.isActive = "Hãy dùng API /status để bật hoặc tắt ngày lễ";
    }
    if (
      this.date === undefined &&
      this.name === undefined
    ) {
      errors.body = "Phải cung cấp date hoặc name";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

class ToggleHolidayStatusDTO {
  constructor(data) {
    this.isActive = data.isActive;
  }

  validate() {
    const errors = {};
    if (typeof this.isActive !== "boolean") {
      errors.isActive = "isActive là bắt buộc và phải là boolean";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

class ListHolidayDTO {
  constructor(query) {
    this.page = query.page === undefined ? 1 : Number(query.page);
    this.limit = query.limit === undefined ? 20 : Number(query.limit);
    this.year = query.year === undefined ? undefined : Number(query.year);
    this.isActive =
      query.isActive === undefined ? undefined : query.isActive === "true";
    this.source = query.source;
    this.name = query.name;
    this.rawIsActive = query.isActive;
  }

  validate() {
    const errors = {};
    if (!Number.isInteger(this.page) || this.page < 1) {
      errors.page = "page phải là số nguyên dương";
    }
    if (!Number.isInteger(this.limit) || this.limit < 1 || this.limit > 100) {
      errors.limit = "limit phải từ 1 đến 100";
    }
    if (
      this.year !== undefined &&
      (!Number.isInteger(this.year) || this.year < 2000 || this.year > 2100)
    ) {
      errors.year = "year phải từ 2000 đến 2100";
    }
    if (
      this.rawIsActive !== undefined &&
      !["true", "false"].includes(this.rawIsActive)
    ) {
      errors.isActive = "isActive phải là true hoặc false";
    }
    if (
      this.source !== undefined &&
      !["GOOGLE_CALENDAR", "MANUAL"].includes(this.source)
    ) {
      errors.source = "Nguồn ngày lễ không hợp lệ";
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = {
  CreateHolidayDTO,
  UpdateHolidayDTO,
  ToggleHolidayStatusDTO,
  ListHolidayDTO,
};

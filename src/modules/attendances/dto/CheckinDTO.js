class CheckinDTO {
  constructor(tenantId, userId, data = {}) {
    data = data || {};

    this.tenantId = tenantId;
    this.userId = userId;
    this.scheduleId = data.scheduleId || null;
    this.actualCheckinAt = new Date(data.actualCheckinAt);
    this.checkInLocation = {
      latitude: data.checkInLocation?.latitude ?? data.latitude,
      longitude: data.checkInLocation?.longitude ?? data.longitude,
      accuracy: data.checkInLocation?.accuracy ?? data.accuracy,
    }
  }

  validate() {
    const errors = [];
    if (!this.tenantId) {
      errors.push("Thiếu thông tin tenant");
    }
    if (!this.userId) {
      errors.push("Thiếu thông tin user");
    }
    if (!this.scheduleId) {
      errors.push("Thiếu thông tin ca làm việc");
    }
    if (
      !this.actualCheckinAt ||
      Number.isNaN(this.actualCheckinAt.getTime())
    ) {
      errors.push("Thời gian check-in không hợp lệ");
    }

    if(this.checkInLocation.latitude === undefined || this.checkInLocation.latitude === null) {
      errors.push("Thiếu thông tin latitude(vĩ độ)");
    }
    if(this.checkInLocation.longitude === undefined || this.checkInLocation.longitude === null) {
      errors.push("Thiếu thông tin longitude(kinh độ) ");
    }
    if(this.checkInLocation.accuracy === undefined || this.checkInLocation.accuracy === null) {
      errors.push("Thiếu thông tin accuracy(độ chính xác) ");
    }

    if(this.checkInLocation.latitude < -90 || this.checkInLocation.latitude > 90) {
      errors.push("Thông tin latitude(vĩ độ)  không hợp lệ");
    }
    if(this.checkInLocation.longitude < -180 || this.checkInLocation.longitude > 180) {
      errors.push("Thông tin longitude(kinh độ)  không hợp lệ");
    }
    if(this.checkInLocation.accuracy < 0) {
      errors.push("Thông tin accuracy(độ chính xác)  không hợp lệ");
    }

    return {
      isValid: errors.length === 0,
      statusCode: errors.length === 0 ? 200 : 400,
      errors,
    };
  }
}

module.exports = { CheckinDTO };

class CheckoutDTO{
    constructor(tenantId, userId, data ={}){
        this.tenantId = tenantId;
        this.userId = userId;
        this.attendanceId = data.attendanceId;
        this.actualCheckoutAt = data.actualCheckoutAt
          ? new Date(data.actualCheckoutAt)
          : null;
        this.checkOutLocation = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
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
    if (!this.attendanceId) {
      errors.push("Thiếu thông tin chấm công");
    }
    if (!this.actualCheckoutAt || Number.isNaN(this.actualCheckoutAt.getTime())) {
      errors.push("Thời gian check-out không hợp lệ");
    }

    if(this.checkOutLocation.latitude === undefined || this.checkOutLocation.latitude === null) {
      errors.push("Thiếu thông tin latitude(vĩ độ)");
    }
    if(this.checkOutLocation.longitude === undefined || this.checkOutLocation.longitude === null) {
      errors.push("Thiếu thông tin longitude(kinh độ) ");
    }
    if(this.checkOutLocation.accuracy === undefined || this.checkOutLocation.accuracy === null) {
      errors.push("Thiếu thông tin accuracy(độ chính xác) ");
    }

    if(this.checkOutLocation.latitude < -90 || this.checkOutLocation.latitude > 90) {
      errors.push("Thông tin latitude(vĩ độ)  không hợp lệ");
    }
    if(this.checkOutLocation.longitude < -180 || this.checkOutLocation.longitude > 180) {
      errors.push("Thông tin longitude(kinh độ)  không hợp lệ");
    }
    if(this.checkOutLocation.accuracy < 0) {
      errors.push("Thông tin accuracy(độ chính xác)  không hợp lệ");
    }

    return {
      isValid: errors.length === 0,
      statusCode: errors.length === 0 ? 200 : 400,
      errors,
    };
  }
}

module.exports = { CheckoutDTO };

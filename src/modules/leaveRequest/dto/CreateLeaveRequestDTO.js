const mongoose = require("mongoose");

class CreateLeaveRequestDTO {
  constructor(tenantId, userId, data = {}) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.status = data.status || "PENDING";
    this.reason = data.reason ? data.reason.trim() : "";
    this.handoverToUserId = data.handoverToUserId || null;
  }

  validate() {
    const errors = {};

    if (!this.tenantId || !mongoose.Types.ObjectId.isValid(this.tenantId)) {
      errors.tenantId = "Tenant không hợp lệ";
    }

    if (!this.userId || !mongoose.Types.ObjectId.isValid(this.userId)) {
      errors.userId = "Nhân viên không hợp lệ";
    }


    const startDate = this.startDate ? new Date(this.startDate) : null;
    const endDate = this.endDate ? new Date(this.endDate) : null;
    const now = new Date();

    if (!this.startDate) {
      errors.startDate = "Ngày bắt đầu là bắt buộc";
    } else if (Number.isNaN(startDate.getTime())) {
      errors.startDate = "Ngày bắt đầu không hợp lệ";
    }

    if (!this.endDate) {
      errors.endDate = "Ngày kết thúc là bắt buộc";
    } else if (Number.isNaN(endDate.getTime())) {
      errors.endDate = "Ngày kết thúc không hợp lệ";
    }

    if (
      startDate &&
      endDate &&
      !Number.isNaN(startDate.getTime()) &&
      !Number.isNaN(endDate.getTime()) &&
      endDate < startDate
    ) {
      errors.endDate = "Ngày kết thúc không được trước ngày bắt đầu";
    }

    if (
      startDate &&
      !Number.isNaN(startDate.getTime()) &&
      startDate < now
    ) {
      errors.startDate = "Ngày bắt đầu không được trước thời điểm hiện tại";
    }

    if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) {
      errors.endDate = "Ngày kết thúc không được trước thời điểm hiện tại";
    }

    if (
      !this.reason ||
      typeof this.reason !== "string" ||
      this.reason.trim() === ""
    ) {
      errors.reason = "Lý do nghỉ phép là bắt buộc";
    }

    if (
      this.handoverToUserId &&
      !mongoose.Types.ObjectId.isValid(this.handoverToUserId)
    ) {
      errors.handoverToUserId = "Nhân viên nhận bàn giao không hợp lệ";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      statusCode: Object.keys(errors).length === 0 ? 200 : 400,
      errors,
    };
  }
}

module.exports = CreateLeaveRequestDTO;

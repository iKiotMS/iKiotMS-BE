// src/modules/holiday/controller/HolidayController.js
const SyncVietnamHolidayDTO = require("../dto/SyncVietnamHolidayDTO");
const HolidaySyncService = require("../service/HolidaySyncService");
const HolidayService = require("../service/HolidayService");

class HolidayController {
  async list(req, res) {
    try {
      const result = await HolidayService.list({
        tenantId: req.user.tenantId,
        query: req.query,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.sendError(res, error, "Không thể lấy danh sách ngày lễ");
    }
  }

  async create(req, res) {
    try {
      const data = await HolidayService.create({
        tenantId: req.user.tenantId,
        data: req.body,
      });
      return res.status(201).json({
        success: true,
        message: "Tạo ngày lễ thành công",
        data,
      });
    } catch (error) {
      return this.sendError(res, error, "Không thể tạo ngày lễ");
    }
  }

  async update(req, res) {
    try {
      const data = await HolidayService.update({
        tenantId: req.user.tenantId,
        holidayId: req.params.holidayId,
        data: req.body,
      });
      return res.status(200).json({
        success: true,
        message: "Cập nhật ngày lễ thành công",
        data,
      });
    } catch (error) {
      return this.sendError(res, error, "Không thể cập nhật ngày lễ");
    }
  }

  async hardDelete(req, res) {
    try {
      const data = await HolidayService.hardDelete({
        tenantId: req.user.tenantId,
        holidayId: req.params.holidayId,
      });
      return res.status(200).json({
        success: true,
        message: "Xóa ngày lễ thành công",
        data,
      });
    } catch (error) {
      return this.sendError(res, error, "Không thể xóa ngày lễ");
    }
  }

  async updateStatus(req, res) {
    try {
      const data = await HolidayService.updateStatus({
        tenantId: req.user.tenantId,
        holidayId: req.params.holidayId,
        data: req.body,
      });
      return res.status(200).json({
        success: true,
        message: data.isActive
          ? "Đã bật ngày lễ"
          : "Đã tắt ngày lễ",
        data,
      });
    } catch (error) {
      return this.sendError(res, error, "Không thể đổi trạng thái ngày lễ");
    }
  }

  async syncVietnamHolidays(req, res) {
    try {
      const syncDTO = new SyncVietnamHolidayDTO(req.body);
      const validation = syncDTO.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await HolidaySyncService.syncVietnamPublicHolidays({
        tenantId: req.user.tenantId,
        year: syncDTO.year,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || "Sync ngày lễ thất bại",
      });
    }
  }

  sendError(res, error, fallbackMessage) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || fallbackMessage,
      ...(error.errors && { errors: error.errors }),
    });
  }
}

module.exports = new HolidayController();

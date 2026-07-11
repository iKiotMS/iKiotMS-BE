// src/modules/holiday/controller/HolidayController.js
const SyncVietnamHolidayDTO = require("../dto/SyncVietnamHolidayDTO");
const HolidaySyncService = require("../service/HolidaySyncService");

class HolidayController {
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
}

module.exports = new HolidayController();

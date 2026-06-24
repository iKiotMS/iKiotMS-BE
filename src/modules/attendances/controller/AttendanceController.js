const {
  TakeAttendanceService,
} = require("../service/TakeAttendanceService");

const takeAttendanceService = new TakeAttendanceService();

class AttendanceController {
  async checkIn(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const data = req.body?.data || req.body || {};

      const result = await takeAttendanceService.checkIn(
        tenantId,
        userId,
        data,
      );

      return res.status(201).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }
  }
}

module.exports = new AttendanceController();

const WorkingScheduleService = require("../service/WorkingScheduleService");

class WorkingScheduleController {
  async createBulkWorkingSchedules(req, res) {
    try {
      const result = await WorkingScheduleService.createBulkWorkingSchedules(
        req.user.tenantId,
        req.user.userId,
        req.body,
      );

      return res.status(201).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async getWorkingScheduleList(req, res) {
    try {
      const result = await WorkingScheduleService.getWorkingScheduleList(
        req.user.tenantId,
        req.query,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async getWorkingScheduleById(req, res) {
    try {
      const result = await WorkingScheduleService.getWorkingScheduleById(
        req.user.tenantId,
        req.params.scheduleId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async updateWorkingSchedule(req, res) {
    try {
      const result = await WorkingScheduleService.updateWorkingSchedule(
        req.user.tenantId,
        req.params.scheduleId,
        req.body,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async deleteWorkingSchedule(req, res) {
    try {
      const result = await WorkingScheduleService.deleteWorkingSchedule(
        req.user.tenantId,
        req.params.scheduleId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }
}

module.exports = new WorkingScheduleController();

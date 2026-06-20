const WorkingScheduleService = require("../service/WorkingScheduleService");

class WorkingScheduleController {
  getRequestData(req) {
    return req.body?.data || req.body || {};
  }

  async createBulkWorkingSchedules(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const createdBy = req.user.userId;
      const userRole = req.user.role;
      const data = this.getRequestData(req);

      const result = await WorkingScheduleService.createBulkWorkingSchedules(
        tenantId,
        createdBy,
        data,
        userRole,
      );

      return res.status(201).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ error: error.message });
    }
  }

  async getWorkingScheduleList(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const result = await WorkingScheduleService.getWorkingScheduleList(
        tenantId,
        req.query,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ error: error.message });
    }
  }

  async getWorkingScheduleById(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const scheduleId = req.params.scheduleId;

      const result = await WorkingScheduleService.getWorkingScheduleById(
        tenantId,
        scheduleId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ error: error.message });
    }
  }

  async updateWorkingSchedule(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const scheduleId = req.params.scheduleId;
      const userRole = req.user.role;
      const data = this.getRequestData(req);

      const result = await WorkingScheduleService.updateWorkingSchedule(
        tenantId,
        scheduleId,
        data,
        userRole,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ error: error.message });
    }
  }

  async deleteWorkingSchedule(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const scheduleId = req.params.scheduleId;

      const result = await WorkingScheduleService.deleteWorkingSchedule(
        tenantId,
        scheduleId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ error: error.message });
    }
  }
}

module.exports = new WorkingScheduleController();

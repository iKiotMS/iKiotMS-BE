const WorkingScheduleService = require("../service/WorkingScheduleService");
const { hasPermission } = require("../../../utils/permissionChecker");

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
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        duplicatedWorkingSchedule: error.duplicatedWorkingSchedule,
      });
    }
  }

  async getWorkingScheduleList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const query = { ...req.query };

      if (!hasPermission(req.user.role, "schedules", "read")) {
        query.userId = req.user.userId;
      }

      const result = await WorkingScheduleService.getWorkingScheduleList(
        tenantId,
        query,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        duplicatedWorkingSchedule: error.duplicatedWorkingSchedule,
      });
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

      if (!hasPermission(req.user.role, "schedules", "read")) {
        const scheduleUserId = result.userId?._id || result.userId;
        if (String(scheduleUserId) !== String(req.user.userId)) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You do not have permission to access this schedule",
          });
        }
      }

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        duplicatedWorkingSchedule: error.duplicatedWorkingSchedule,
      });
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
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        duplicatedWorkingSchedule: error.duplicatedWorkingSchedule,
      });
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
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        duplicatedWorkingSchedule: error.duplicatedWorkingSchedule,
      });
    }
  }
}

module.exports = new WorkingScheduleController();

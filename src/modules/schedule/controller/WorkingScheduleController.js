const WorkingScheduleService = require("../service/WorkingScheduleService");
const {
  hasPermission,
  validateRoleHierarchy,
} = require("../../../utils/permissionChecker");

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

  async getBranchWorkingSchedules(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const result = await WorkingScheduleService.getBranchWorkingSchedules(
        tenantId,
        req.user.branchId,
        req.query,
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

  async getWarehouseWorkingSchedules(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const result = await WorkingScheduleService.getWarehouseWorkingSchedules(
        tenantId,
        req.user.warehouseId,
        req.query,
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

  async getCurrentWorkingSchedule(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;

      const result = await WorkingScheduleService.getCurrentWorkingSchedule(
        tenantId,
        userId,
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

  async getMyWorkingSchedules(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;

      const result = await WorkingScheduleService.getMyWorkingSchedules(
        tenantId,
        userId,
        req.query,
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

  async getWorkingScheduleUserDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { scheduleId, userId } = req.params;
      const isOwnScheduleDetail = String(userId) === String(req.user.userId);

      if (
        !hasPermission(req.user.role, "schedules", "read") &&
        !hasPermission(req.user.role, "schedules", "readBR") &&
        !hasPermission(req.user.role, "schedules", "readWH") &&
        !isOwnScheduleDetail
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You can only access your own schedule detail",
        });
      }

      const result = await WorkingScheduleService.getWorkingScheduleUserDetail(
        tenantId,
        scheduleId,
        userId,
      );

      if (
        !isOwnScheduleDetail &&
        !validateRoleHierarchy(req.user.role, result.user?.role)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: You do not have permission to access this staff schedule detail",
        });
      }

      if (
        req.user.role === "BRANCH_MANAGER" &&
        String(result.user?.branchId?._id || result.user?.branchId) !==
          String(req.user.branchId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: You can only access schedule details for staff in your branch",
        });
      }

      if (
        req.user.role === "WAREHOUSE_MANAGER" &&
        String(result.user?.warehouseId?._id || result.user?.warehouseId) !==
          String(req.user.warehouseId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: You can only access schedule details for staff in your warehouse",
        });
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

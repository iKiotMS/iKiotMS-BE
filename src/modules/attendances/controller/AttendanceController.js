const {
  TakeAttendanceService,
} = require("../service/TakeAttendanceService");
const {
  ManageAttendanceService,
} = require("../service/ManageAttendanceService");
const { hasPermission } = require("../../../utils/permissionChecker");

const takeAttendanceService = new TakeAttendanceService();
const manageAttendanceService = new ManageAttendanceService();

class AttendanceController {
  getUserWorkplaceFilter(user) {
    if (user.branchId) {
      return { branchId: user.branchId };
    }

    if (user.warehouseId) {
      return { warehouseId: user.warehouseId };
    }

    return {};
  }

  getReadAccessFilter(user) {
    if (user.role === "BRANCH_MANAGER") {
      if (!user.branchId) {
        const error = new Error("Branch manager is not assigned to a branch");
        error.statusCode = 403;
        throw error;
      }

      return this.getUserWorkplaceFilter(user);
    }

    if (user.role === "WAREHOUSE_MANAGER") {
      if (!user.warehouseId) {
        const error = new Error(
          "Warehouse manager is not assigned to a warehouse",
        );
        error.statusCode = 403;
        throw error;
      }

      return this.getUserWorkplaceFilter(user);
    }

    if (!hasPermission(user.role, "attendances", "read")) {
      return { userId: user.userId };
    }

    return {};
  }

  async getAttendances(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const accessFilter = this.getReadAccessFilter(req.user);
      const result = await manageAttendanceService.getAttendances(
        tenantId,
        {
          ...req.query,
          ...accessFilter,
        },
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }
  }

  async getMyAttendances(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const workplaceFilter = this.getUserWorkplaceFilter(req.user);
      const {
        scheduleId,
        status,
        checkinFrom,
        checkinTo,
        checkoutFrom,
        checkoutTo,
        lateOnly,
        overtimeOnly,
        missingCheckout,
        page,
        recordPerPage,
      } = req.query;
      const result = await manageAttendanceService.getAttendances(tenantId, {
        scheduleId,
        status,
        checkinFrom,
        checkinTo,
        checkoutFrom,
        checkoutTo,
        lateOnly,
        overtimeOnly,
        missingCheckout,
        page,
        recordPerPage,
        userId,
        ...workplaceFilter,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }
  }

  async getAttendanceDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { attendanceId } = req.params;
      const attendance = await manageAttendanceService.getAttendanceById(
        tenantId,
        attendanceId,
        req.user,
      );

      return res.status(200).json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }
  }

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

  async checkOut(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const data = req.body?.data || req.body || {};

      const result = await takeAttendanceService.checkOut(
        tenantId,
        userId,
        data,
      );

      return res.status(200).json(result);
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

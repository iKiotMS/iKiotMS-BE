const {
  TakeAttendanceService,
} = require("../service/TakeAttendanceService");
const {
  ManageAttendanceService,
} = require("../service/ManageAttendanceService");
const { hasPermission } = require("../../../utils/permissionChecker");
const ManualCheckoutDTO = require("../dto/ManualCheckoutDTO");
const CreateManualAttendanceDTO = require("../dto/CreateManualAttendanceDTO");

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
        payrollPeriodId: error.payrollPeriodId,
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
        payrollPeriodId: error.payrollPeriodId,
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
        payrollPeriodId: error.payrollPeriodId,
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
        payrollPeriodId: error.payrollPeriodId,
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

  async manualCheckout(req, res) {
    try {
      const dto = new ManualCheckoutDTO(req.body?.data || req.body || {});
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Dữ liệu không hợp lệ",
          errors: validation.errors,
        });
      }

      const attendance = await manageAttendanceService.manualCheckout(
        req.user.tenantId,
        req.params.attendanceId,
        dto,
        req.user,
      );
      return res.status(200).json({
        success: true,
        message: "Đã bổ sung giờ check-out thủ công",
        data: attendance,
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        errors: error.errors,
        payrollPeriodId: error.payrollPeriodId,
      });
    }
  }

  async createManualAttendance(req, res) {
    try {
      const dto = new CreateManualAttendanceDTO(req.body?.data || req.body || {});
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Dữ liệu không hợp lệ",
          errors: validation.errors,
        });
      }
      const attendance = await manageAttendanceService.createManualAttendance(
        req.user.tenantId,
        dto,
        req.user,
      );
      return res.status(201).json({
        success: true,
        message:
          dto.status === "ABSENT"
            ? "Đã đánh dấu nhân viên vắng mặt"
            : "Đã tạo chấm công thủ công",
        data: attendance,
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        errors: error.errors,
        payrollPeriodId: error.payrollPeriodId,
      });
    }
  }
}

module.exports = new AttendanceController();

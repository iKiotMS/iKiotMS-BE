const LeaveRequestService = require("../service/LeaveRequestService");
const mongoose = require("mongoose");
const { LeaveRequest, User } = require("../../../models");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");
const LeaveRequestPerDayQueryDTO = require("../dto/LeaveRequestPerDayQueryDTO");

class LeaveRequestController {
  handleError(res, error, fallbackMessage = "Thao tác yêu cầu nghỉ phép thất bại") {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || fallbackMessage,
      ...(error.errors && { errors: error.errors }),
    });
  }

  sameId(left, right) {
    return left?.toString() === right?.toString();
  }

  canAccessBranch(req, branchId) {
    return (
      req.user.role !== "BRANCH_MANAGER" ||
      this.sameId(branchId, req.user.branchId)
    );
  }

  canAccessWarehouse(req, warehouseId) {
    return (
      req.user.role !== "WAREHOUSE_MANAGER" ||
      this.sameId(warehouseId, req.user.warehouseId)
    );
  }

  async getLeaveRequestForReview(req) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Mã yêu cầu nghỉ phép không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const leaveRequest = await LeaveRequest.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    })
      .populate({
        path: "userId",
        select: "role branchId warehouseId",
      })
      .lean();

    if (!leaveRequest) {
      const error = new Error("Không tìm thấy yêu cầu nghỉ phép");
      error.statusCode = 404;
      throw error;
    }

    const targetUser = leaveRequest.userId;

    if (validateRoleHierarchy(req.user.role, targetUser?.role) === false) {
      const error = new Error(
        `Vai trò ${req.user.role} không có quyền duyệt yêu cầu nghỉ phép của vai trò ${targetUser?.role}`,
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      req.user.role === "BRANCH_MANAGER" &&
      !this.sameId(targetUser?.branchId, req.user.branchId)
    ) {
      const error = new Error(
        "Bạn chỉ có thể duyệt yêu cầu nghỉ phép của nhân viên trong chi nhánh của mình",
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      req.user.role === "WAREHOUSE_MANAGER" &&
      !this.sameId(targetUser?.warehouseId, req.user.warehouseId)
    ) {
      const error = new Error(
        "Bạn chỉ có thể duyệt yêu cầu nghỉ phép của nhân viên trong kho của mình",
      );
      error.statusCode = 403;
      throw error;
    }

    return leaveRequest;
  }

  async create(req, res) {
    try {
      const leaveRequest = await LeaveRequestService.createLeaveRequest({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        leaveRequestData: req.body,
        user: req.user,
      });

      return res.status(201).json({
        success: true,
        message: "Tạo yêu cầu nghỉ phép thành công",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Tạo yêu cầu nghỉ phép thất bại");
    }
  }

  async createEmergency(req, res) {
    try {
      const onBehalfOfUserId = req.body?.userId;

      if (!mongoose.Types.ObjectId.isValid(onBehalfOfUserId)) {
        return res.status(400).json({
          success: false,
          message: "Mã nhân viên không hợp lệ",
        });
      }

      const targetUser = await User.findOne({
        _id: onBehalfOfUserId,
        tenantId: req.user.tenantId,
        status: { $ne: "DELETED" },
      })
        .select("role branchId warehouseId")
        .lean();

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy nhân viên",
        });
      }

      if (validateRoleHierarchy(req.user.role, targetUser.role) === false) {
        return res.status(403).json({
          success: false,
          message: `Vai trò ${req.user.role} không có quyền tạo yêu cầu nghỉ phép cho vai trò ${targetUser.role}`,
        });
      }

      if (
        req.user.role === "BRANCH_MANAGER" &&
        targetUser.branchId?.toString() !== req.user.branchId?.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ có thể tạo yêu cầu nghỉ phép cho nhân viên trong chi nhánh của mình",
        });
      }

      if (
        req.user.role === "WAREHOUSE_MANAGER" &&
        targetUser.warehouseId?.toString() !== req.user.warehouseId?.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ có thể tạo yêu cầu nghỉ phép cho nhân viên trong kho của mình",
        });
      }

      const leaveRequest = await LeaveRequestService.createLeaveRequest({
        tenantId: req.user.tenantId,
        userId: req.body.userId,
        leaveRequestData: req.body,
      });

      return res.status(201).json({
        success: true,
        message: "Tạo yêu cầu nghỉ phép khẩn cấp thành công",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(
        res,
        error,
        "Tạo yêu cầu nghỉ phép khẩn cấp thất bại",
      );
    }
  }

  async previewScheduleHandover(req, res) {
    try {
      const result = await LeaveRequestService.previewScheduleHandover({
        tenantId: req.user.tenantId,
        user: req.user,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy thông tin bàn giao lịch làm việc thành công",
        data: result,
      });
    } catch (error) {
      return this.handleError(
        res,
        error,
        "Lấy thông tin bàn giao lịch làm việc thất bại",
      );
    }
  }

  async getPersonalHistory(req, res) {
    try {
      const filter = req.query || {};

      const leaveRequests = await LeaveRequestService.getLeaveRequests({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        filter: {
          ...filter,
          userId: req.user.userId,
        },
        page: filter.page,
        recordPerPage: filter.recordPerPage,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy lịch sử nghỉ phép cá nhân thành công",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(
        res,
        error,
        "Lấy lịch sử nghỉ phép cá nhân thất bại",
      );
    }
  }

  async getPersonalHistoryPerDay(req, res) {
    try {
      const queryDTO = new LeaveRequestPerDayQueryDTO(req.query);
      const validation = queryDTO.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const leaveRequests = await LeaveRequestService.getMyLeaveRequestsPerDay({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        filter: queryDTO,
      });
      return res.status(200).json({
        success: true,
        message: "Lấy lịch sử nghỉ phép cá nhân theo ngày thành công",
        data: leaveRequests,
      });
    } catch (error) {
      return this.handleError(res, error, "Lấy lịch sử nghỉ phép cá nhân theo ngày thất bại");
    }
  }

  async getBalance(req, res) {
    try {
      const leaveBalance = await LeaveRequestService.getLeaveBalance({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy số ngày nghỉ phép còn lại thành công",
        data: leaveBalance,
      });
    } catch (error) {
      return this.handleError(res, error, "Lấy số ngày nghỉ phép còn lại thất bại");
    }
  }

  async getAll(req, res) {
    try {
      const filter = req.query || {};

      const leaveRequests = await LeaveRequestService.getLeaveRequests({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        filter,
        page: filter.page,
        recordPerPage: filter.recordPerPage,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách yêu cầu nghỉ phép thành công",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(res, error, "Lấy danh sách yêu cầu nghỉ phép thất bại");
    }
  }

  async getByBranch(req, res) {
    try {
      const filter = req.query || {};

      if (!req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: "Người dùng chưa được gán vào chi nhánh",
        });
      }

      const leaveRequests = await LeaveRequestService.getLeaveRequests({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        filter: {
          ...filter,
          branchId: req.user.branchId,
        },
        page: filter.page,
        recordPerPage: filter.recordPerPage,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách yêu cầu nghỉ phép theo chi nhánh thành công",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(
        res,
        error,
        "Lấy yêu cầu nghỉ phép theo chi nhánh thất bại",
      );
    }
  }

  async getByWarehouse(req, res) {
    try {
      const filter = req.query || {};

      if (!req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: "Người dùng chưa được gán vào kho",
        });
      }

      const leaveRequests = await LeaveRequestService.getLeaveRequests({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        filter: {
          ...filter,
          warehouseId: req.user.warehouseId,
        },
        page: filter.page,
        recordPerPage: filter.recordPerPage,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách yêu cầu nghỉ phép theo kho thành công",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(
        res,
        error,
        "Lấy yêu cầu nghỉ phép theo kho thất bại",
      );
    }
  }

  async getDetail(req, res) {
    try {
      const leaveRequest = await LeaveRequestService.getLeaveRequestById({
        tenantId: req.user.tenantId,
        user: req.user,
        leaveRequestId: req.params.id,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy chi tiết yêu cầu nghỉ phép thành công",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Lấy chi tiết yêu cầu nghỉ phép thất bại");
    }
  }

  async cancel(req, res) {
    try {
      const leaveRequest = await LeaveRequestService.cancelLeaveRequest({
        tenantId: req.user.tenantId,
        leaveRequestId: req.params.id,
        userId: req.user.userId,
        data: {},
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Hủy yêu cầu nghỉ phép thành công",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Hủy yêu cầu nghỉ phép thất bại");
    }
  }

  async approve(req, res) {
    try {
      await this.getLeaveRequestForReview(req);

      const leaveRequest = await LeaveRequestService.approveLeaveRequest({
        tenantId: req.user.tenantId,
        leaveRequestId: req.params.id,
        data: {
          approvedBy: req.user.userId,
          paidLeaveDays: req.body?.paidLeaveDays,
          unpaidLeaveDays: req.body?.unpaidLeaveDays,
          reviewNote: req.body?.reviewNote,
        },
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Duyệt yêu cầu nghỉ phép thành công",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Duyệt yêu cầu nghỉ phép thất bại");
    }
  }
  async reject(req, res) {
    try {
      await this.getLeaveRequestForReview(req);

      const leaveRequest = await LeaveRequestService.rejectLeaveRequest({
        tenantId: req.user.tenantId,
        leaveRequestId: req.params.id,
        data: {
          approvedBy: req.user.userId,
          reviewNote: req.body?.reviewNote,
        },
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Từ chối yêu cầu nghỉ phép thành công",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Từ chối yêu cầu nghỉ phép thất bại");
    }
  }
}

module.exports = new LeaveRequestController();

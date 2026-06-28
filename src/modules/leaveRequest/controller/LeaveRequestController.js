const LeaveRequestService = require("../service/LeaveRequestService");
const mongoose = require("mongoose");
const { LeaveRequest, User } = require("../../../models");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");

class LeaveRequestController {
  handleError(res, error, fallbackMessage = "Leave request operation failed") {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || fallbackMessage,
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
      const error = new Error("Invalid leave request id");
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
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    const targetUser = leaveRequest.userId;

    if (validateRoleHierarchy(req.user.role, targetUser?.role) === false) {
      const error = new Error(
        `Your role (${req.user.role}) do not have permission to review leave request for role ${targetUser?.role}`,
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      req.user.role === "BRANCH_MANAGER" &&
      !this.sameId(targetUser?.branchId, req.user.branchId)
    ) {
      const error = new Error("You can only review leave requests for staff in your branch");
      error.statusCode = 403;
      throw error;
    }

    if (
      req.user.role === "WAREHOUSE_MANAGER" &&
      !this.sameId(targetUser?.warehouseId, req.user.warehouseId)
    ) {
      const error = new Error("You can only review leave requests for staff in your warehouse");
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
      });

      return res.status(201).json({
        success: true,
        message: "Leave request created successfully",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to create leave request");
    }
  }

  async createEmergency(req, res) {
    try {
      const onBehalfOfUserId = req.body?.userId;

      if (!mongoose.Types.ObjectId.isValid(onBehalfOfUserId)) {
        return res.status(400).json({
          success: false,
          message: "Valid userId is required",
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
          message: "Employee not found",
        });
      }

      if (validateRoleHierarchy(req.user.role, targetUser.role) === false) {
        return res.status(403).json({
          success: false,
          message: `Your role (${req.user.role}) do not have permission to create leave request for role ${targetUser.role}`,
        });
      }

      if (
        req.user.role === "BRANCH_MANAGER" &&
        targetUser.branchId?.toString() !== req.user.branchId?.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only create leave requests for staff in your branch",
        });
      }

      if (
        req.user.role === "WAREHOUSE_MANAGER" &&
        targetUser.warehouseId?.toString() !== req.user.warehouseId?.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only create leave requests for staff in your warehouse",
        });
      }

      const leaveRequest = await LeaveRequestService.createLeaveRequest({
        tenantId: req.user.tenantId,
        userId: req.body.userId,
        leaveRequestData: req.body,
      });

      return res.status(201).json({
        success: true,
        message: "Emergency leave request created successfully",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to create emergency leave request");
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
        message: "Personal leave request history retrieved successfully",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to get personal leave request history");
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
        message: "Leave requests retrieved successfully",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to get leave requests");
    }
  }

  async getByBranch(req, res) {
    try {
      const filter = req.query || {};

      if (!req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: "User is not assigned to a branch",
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
        message: "Leave requests retrieved by branch successfully",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to get leave requests by branch");
    }
  }

  async getByWarehouse(req, res) {
    try {
      const filter = req.query || {};

      if (!req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: "User is not assigned to a warehouse",
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
        message: "Leave requests retrieved by warehouse successfully",
        data: leaveRequests.leaveRequests,
        pagination: leaveRequests.pagination,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to get leave requests by warehouse");
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
        message: "Leave request retrieved successfully",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to get leave request");
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
        message: "Leave request cancelled successfully",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to cancel leave request");
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
          reviewNote: req.body?.reviewNote,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Leave request approved successfully",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to approve leave request");
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
        message: "Leave request rejected successfully",
        data: leaveRequest,
      });
    } catch (error) {
      return this.handleError(res, error, "Failed to reject leave request");
    }
  }
}

module.exports = new LeaveRequestController();

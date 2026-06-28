const BaseService = require("../../../common/services/baseService");
const LeaveRequest = require("../../../models/LeaveRequest");
const CreateLeaveRequestDTO = require("../dto/CreateLeaveRequestDTO");
const mongoose = require("mongoose");
const { User } = require("../../../models");
const UpdateLeaveRequestDTO = require("../dto/UpdateLeaveRequestDTO");

class LeaveRequestService extends BaseService {
  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async fetchLeaveRequests({
    tenantId,
    query,
    selectedFields,
    populatedFields,
    page,
    recordPerPage,
  }) {
    let filter = { tenantId };
    let userFilter = { tenantId };
    const pagination = this.getPagination({ page, recordPerPage });

    if (query._id) filter._id = query._id;

    if (query.userId) filter.userId = query.userId;

    if (query.status) filter.status = query.status;

    if (query.branchId) userFilter.branchId = query.branchId;
    if (query.warehouseId) userFilter.warehouseId = query.warehouseId;

    if (query.leaveType) filter.leaveType = query.leaveType;
    if (query.status) filter.status = query.status;
    if (query.role) userFilter.role = query.role;

    if (query.startDate || query.endDate) {
      filter.startDate = {};

      if (query.startDate) {
        filter.startDate.$gte = new Date(query.startDate);
      }

      if (query.endDate) {
        filter.startDate.$lte = new Date(query.endDate);
      }
    }

    const keyword = query.keyword?.trim() || "";

    if (query.branchId || query.warehouseId || query.role) {
      const scopedUsers = await User.find(userFilter).select("_id").lean();
      filter.userId = { $in: scopedUsers.map((u) => u._id) };
    }

    if (keyword) {
      const keywordRegex = {
        $regex: this.escapeRegex(keyword),
        $options: "i",
      };

      const users = await User.find({
        ...userFilter,
        $or: [
          { "profile.firstName": keywordRegex },
          { "profile.lastName": keywordRegex },
        ],
      })
        .select("_id")
        .lean();

      filter.$or = [
        { reason: keywordRegex },
        { userId: { $in: users.map((u) => u._id) } },
      ];
    }

    const [leaveRequests, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate({
          path: "userId",
          select: "branchId warehouseId profile email",
        })
        .populate(populatedFields)
        .select(selectedFields)
        .skip(pagination.skip)
        .limit(pagination.recordPerPage)
        .lean(),
      LeaveRequest.countDocuments(filter),
    ]);

    return {
      leaveRequests,
      pagination: {
        total,
        page: pagination.page,
        recordPerPage: pagination.recordPerPage,
        totalPage: Math.ceil(total / pagination.recordPerPage),
      },
    };
  }

  async getLeaveRequests({ tenantId, filter, page, recordPerPage }) {
    const selectedFields = "userId leaveType startDate endDate status reason";
    const populatedFields = {
      path: "userId",
      select: "branchId warehouseId profile email",
      populate: [
        {
          path: "branchId",
          select: "name",
        },
        {
          path: "warehouseId",
          select: "name",
        },
      ],
    };
    const leaveRequests = await this.fetchLeaveRequests({
      tenantId,
      query: { ...filter },
      selectedFields,
      populatedFields,
      page,
      recordPerPage,
    });
    return leaveRequests;
  }

  sameId(left, right) {
    return left?.toString() === right?.toString();
  }

  assertCanReadLeaveRequest(user, leaveRequest) {
    const targetUser = leaveRequest.userId;

    if (this.sameId(targetUser?._id, user.userId)) {
      return;
    }

    if (["SUPER_ADMIN", "TENANT_OWNER"].includes(user.role)) {
      return;
    }

    if (
      user.role === "BRANCH_MANAGER" &&
      !targetUser?.warehouseId &&
      this.sameId(
        targetUser?.branchId?._id || targetUser?.branchId,
        user.branchId,
      )
    ) {
      return;
    }

    if (
      user.role === "WAREHOUSE_MANAGER" &&
      !targetUser?.branchId &&
      this.sameId(
        targetUser?.warehouseId?._id || targetUser?.warehouseId,
        user.warehouseId,
      )
    ) {
      return;
    }

    const error = new Error(
      "You do not have permission to read this leave request",
    );
    error.statusCode = 403;
    throw error;
  }

  async getLeaveRequestById({ tenantId, user, leaveRequestId }) {
    if (!mongoose.Types.ObjectId.isValid(leaveRequestId)) {
      const error = new Error("Invalid leave request id");
      error.statusCode = 400;
      throw error;
    }

    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      tenantId,
    })
      .populate({
        path: "userId",
        select: "role branchId warehouseId profile email",
        populate: [
          {
            path: "branchId",
            select: "name",
          },
          {
            path: "warehouseId",
            select: "name",
          },
        ],
      })
      .lean();

    if (!leaveRequest) {
      let error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    this.assertCanReadLeaveRequest(user, leaveRequest);

    return leaveRequest;
  }

  async createLeaveRequest({ tenantId, userId, leaveRequestData }) {
    const leaveRequest = new CreateLeaveRequestDTO(
      tenantId,
      userId,
      leaveRequestData,
    );
    const validation = leaveRequest.validate();
    if (!validation.isValid) {
      let error = new Error(
        `Validation failed: ${validation.errors.join(", ")}`,
      );
      error.statusCode = validation.statusCode || 400;
      throw error;
    }

    const createdLeaveRequest = await LeaveRequest.create(leaveRequest);
    return {
      statusCode: validation.statusCode,
      success: true,
      message: "Leave request created successfully",
      leaveRequest: createdLeaveRequest,
    };
  }

  async updateLeaveRequest({ tenantId, leaveRequestId, leaveRequestData }) {
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      tenantId,
    });
    if (!leaveRequest) {
      let error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }
    const updateDTO = new UpdateLeaveRequestDTO(leaveRequestData);
    const validation = updateDTO.validate();
    if (!validation.isValid) {
      let error = new Error(
        `Validation failed: ${validation.errors.join(", ")}`,
      );
      error.statusCode = validation.statusCode || 400;
      throw error;
    }

    const updateData = updateDTO.toUpdateData();

    const startDate = updateData.startDate || leaveRequest.startDate;
    const endDate = updateData.endDate || leaveRequest.endDate;

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      const error = new Error("End date cannot be before start date");
      error.statusCode = 400;
      throw error;
    }

    const result = await LeaveRequest.findOneAndUpdate(
      { _id: leaveRequestId, tenantId },
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .select("-__v")
      .lean();
    return {
      result,
    };
  }

  async reviewLeaveRequest({ tenantId, leaveRequestId, data }) {
    if (!data.approvedBy || !mongoose.Types.ObjectId.isValid(data.approvedBy)) {
      let error = new Error("Approver is required");
      error.statusCode = 400;
      throw error;
    }

    if (
      data.status === "REJECTED" &&
      (!data.reviewNote ||
        typeof data.reviewNote !== "string" ||
        data.reviewNote.trim() === "")
    ) {
      let error = new Error(
        "Review note is required when rejecting a leave request",
      );
      error.statusCode = 400;
      throw error;
    }
    if (!data.status || !["APPROVED", "REJECTED"].includes(data.status)) {
      let error = new Error(
        "Status is required and must be either APPROVED or REJECTED",
      );
      error.statusCode = 400;
      throw error;
    }

    const currentLeaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      tenantId,
    });

    if (!currentLeaveRequest) {
      let error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    if (currentLeaveRequest.status !== "PENDING") {
      let error = new Error("Only pending leave requests can be reviewed");
      error.statusCode = 400;
      throw error;
    }

    const leaveRequest = await this.updateLeaveRequest({
      tenantId,
      leaveRequestId,
      leaveRequestData: data,
    });
    return leaveRequest;
  }

  async approveLeaveRequest({ tenantId, leaveRequestId, data }) {
    data.status = "APPROVED";
    const result = await this.reviewLeaveRequest({
      tenantId,
      leaveRequestId,
      data,
    });
    return {
      statusCode: 200,
      success: true,
      message: "Leave request approved successfully",
      result,
    };
  }

  async rejectLeaveRequest({ tenantId, leaveRequestId, data }) {
    data.status = "REJECTED";
    const result = await this.reviewLeaveRequest({
      tenantId,
      leaveRequestId,
      data,
    });
    return {
      statusCode: 200,
      success: true,
      message: "Leave request rejected successfully",
      result,
    };
  }

  async cancelLeaveRequest({ tenantId, leaveRequestId, data = {}, userId }) {
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      tenantId,
    });

    if (!leaveRequest) {
      let error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    if (userId && leaveRequest.userId.toString() !== userId.toString()) {
      let error = new Error("You can only cancel your own leave request");
      error.statusCode = 403;
      throw error;
    }

    if (!["PENDING", "APPROVED"].includes(leaveRequest.status)) {
      let error = new Error(
        "Only pending or approved leave requests can be cancelled",
      );
      error.statusCode = 400;
      throw error;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(leaveRequest.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (startDate <= today) {
      let error = new Error(
        "Leave request cannot be cancelled after the leave date has arrived",
      );
      error.statusCode = 400;
      throw error;
    }

    data.status = "CANCELLED";
    const result = await this.updateLeaveRequest({
      tenantId,
      leaveRequestId,
      leaveRequestData: data,
    });
    return {
      statusCode: 200,
      success: true,
      message: "Leave request cancelled successfully",
      result,
    };
  }

  async deleteLeaveRequest({ tenantId, leaveRequestId }) {
    const result = await LeaveRequest.updateOne(
      { _id: leaveRequestId, tenantId },
      { $set: { status: "DELETED" } },
    );
    return {
      statusCode: 200,
      success: true,
      message: "Leave request deleted successfully",
      result,
    };
  }
}
module.exports = new LeaveRequestService();

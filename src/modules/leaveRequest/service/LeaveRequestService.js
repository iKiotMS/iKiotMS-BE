const BaseService = require("../../../common/services/baseService");
const LeaveRequest = require("../../../models/LeaveRequest");
const CreateLeaveRequestDTO = require("../dto/CreateLeaveRequestDTO");
const mongoose = require("mongoose");
const { User, WorkingSchedule } = require("../../../models");
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

  getLocalDateText(dateValue) {
    if (typeof dateValue === "string") {
      return dateValue.slice(0, 10);
    }

    return dateValue.toISOString().slice(0, 10);
  }

  buildWorkDate(dateValue) {
    return new Date(`${this.getLocalDateText(dateValue)}T00:00:00.000Z`);
  }

  getPreviewDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
      const error = new Error("startDate and endDate are required");
      error.statusCode = 400;
      throw error;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const error = new Error("Invalid leave date range");
      error.statusCode = 400;
      throw error;
    }

    const startWorkDate = this.buildWorkDate(startDate);
    const endWorkDateExclusive = this.buildWorkDate(endDate);
    endWorkDateExclusive.setUTCDate(endWorkDateExclusive.getUTCDate() + 1); // append one day to enddate to... 2026-07-1T00:00:00.000Z <= date < 2026-07-2T00:00:00.000Z 

    if (startWorkDate >= endWorkDateExclusive) {
      const error = new Error("End date cannot be before start date");
      error.statusCode = 400;
      throw error;
    }

    return { startWorkDate, endWorkDateExclusive };
  }

  async previewScheduleHandover({ tenantId, user, startDate, endDate }) {
    const managerRoles = ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"];
    const { startWorkDate, endWorkDateExclusive } = this.getPreviewDateRange(
      startDate,
      endDate,
    );

    if (!managerRoles.includes(user.role)) {
      return {
        requiresHandover: false,
        count: 0,
        affectedSchedules: [],
        message: "Current user does not need schedule handover",
      };
    }

    const affectedSchedules = await WorkingSchedule.find({
      tenantId,
      managedBy: user.userId,
      workDate: {
        $gte: startWorkDate,
        $lt: endWorkDateExclusive,
      },
      status: "SCHEDULED",
    })
      .populate("userId", "phoneNumber profile role branchId warehouseId")
      .populate("shiftTemplateId")
      .populate("managedBy", "phoneNumber profile role")
      .select(
        "_id userId managedBy shiftTemplateId workDate startAt endAt status",
      )
      .sort({ workDate: 1, startAt: 1 })
      .lean();

    return {
      requiresHandover: affectedSchedules.length > 0,
      count: affectedSchedules.length,
      affectedSchedules,
    };
  }

  isManager(user, userId) {
    return (
      ["BRANCH_MANAGER", "WAREHOUSE_MANAGER"].includes(user?.role) &&
      this.sameId(user.userId, userId)
    );
  }

  buildManagedScheduleFilter({ tenantId, managerId, startDate, endDate }) {
    const { startWorkDate, endWorkDateExclusive } = this.getPreviewDateRange(
      startDate,
      endDate,
    );

    return {
      tenantId,
      managedBy: managerId,
      workDate: {
        $gte: startWorkDate,
        $lt: endWorkDateExclusive,
      },
      status: "SCHEDULED",
    };
  }

  async validateScheduleHandoverTarget({
    tenantId,
    manager,
    handoverToUserId,
    session,
  }) {
    if (!handoverToUserId) {
      const error = new Error(
        "handoverToUserId is required because this manager has schedules during the leave date range",
      );
      error.statusCode = 400;
      throw error;
    }

    if (this.sameId(manager.userId, handoverToUserId)) {
      const error = new Error("Manager cannot hand over schedules to themselves");
      error.statusCode = 400;
      throw error;
    }

    const handoverUser = await User.findOne({
      _id: handoverToUserId,
      tenantId,
      status: { $nin: ["DELETED", "SUSPENDED", "INACTIVE"] },
    })
      .select("_id role branchId warehouseId")
      .session(session)
      .lean();

    if (!handoverUser) {
      const error = new Error("Handover user not found or inactive");
      error.statusCode = 404;
      throw error;
    }

    if (
      manager.role === "BRANCH_MANAGER" &&
      !this.sameId(handoverUser.branchId, manager.branchId)
    ) {
      const error = new Error("Handover user must be in the same branch");
      error.statusCode = 400;
      throw error;
    }

    if (
      manager.role === "WAREHOUSE_MANAGER" &&
      !this.sameId(handoverUser.warehouseId, manager.warehouseId)
    ) {
      const error = new Error("Handover user must be in the same warehouse");
      error.statusCode = 400;
      throw error;
    }

    return handoverUser;
  }

  async createLeaveRequest({ tenantId, userId, leaveRequestData, user }) {
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

    const isManagerLeave = this.isManager(user, userId);

    if (!isManagerLeave && leaveRequest.handoverToUserId) {
      let error = new Error(
        "handoverToUserId is only allowed for your own manager leave request",
      );
      error.statusCode = 400;
      throw error;
    }

    const session = await mongoose.startSession();
    let createdLeaveRequest;
    let handover = {
      required: false,
      reassignedSchedules: 0,
      handoverToUserId: null,
    };

    try {
      await session.withTransaction(async () => {
        let affectedScheduleIds = [];

        if (isManagerLeave) {
          const scheduleFilter = this.buildManagedScheduleFilter({
            tenantId,
            managerId: userId,
            startDate: leaveRequest.startDate,
            endDate: leaveRequest.endDate,
          });

          const affectedSchedules = await WorkingSchedule.find(scheduleFilter)
            .select("_id")
            .session(session)
            .lean();

          affectedScheduleIds = affectedSchedules.map((schedule) => schedule._id);
          handover.required = affectedScheduleIds.length > 0;

          if (handover.required) {
            await this.validateScheduleHandoverTarget({
              tenantId,
              manager: user,
              handoverToUserId: leaveRequest.handoverToUserId,
              session,
            });
          } else {
            leaveRequest.handoverToUserId = null;
          }
        }

        const createdLeaveRequests = await LeaveRequest.create([leaveRequest], {
          session,
        });
        createdLeaveRequest = createdLeaveRequests[0];

        if (affectedScheduleIds.length > 0) {
          await WorkingSchedule.updateMany(
            {
              _id: { $in: affectedScheduleIds },
              tenantId,
              managedBy: userId,
            },
            {
              $set: {
                managedBy: leaveRequest.handoverToUserId,
              },
            },
            { session },
          );

          handover = {
            required: true,
            reassignedSchedules: affectedScheduleIds.length,
            handoverToUserId: leaveRequest.handoverToUserId,
          };
        }
      });
    } finally {
      await session.endSession();
    }

    return {
      statusCode: validation.statusCode,
      success: true,
      message: "Leave request created successfully",
      leaveRequest: createdLeaveRequest,
      handover,
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
    return result;
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
    return this.reviewLeaveRequest({
      tenantId,
      leaveRequestId,
      data,
    });
  }

  async rejectLeaveRequest({ tenantId, leaveRequestId, data }) {
    data.status = "REJECTED";
    return this.reviewLeaveRequest({
      tenantId,
      leaveRequestId,
      data,
    });
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
    today.setUTCHours(0, 0, 0, 0);

    const startDate = new Date(leaveRequest.startDate);
    startDate.setUTCHours(0, 0, 0, 0);

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
    return result;
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

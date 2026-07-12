const BaseService = require("../../../common/services/baseService");
const LeaveRequest = require("../../../models/LeaveRequest");
const CreateLeaveRequestDTO = require("../dto/CreateLeaveRequestDTO");
const mongoose = require("mongoose");
const { User, WorkingSchedule } = require("../../../models");
const UpdateLeaveRequestDTO = require("../dto/UpdateLeaveRequestDTO");
const NotificationService = require("../../../services/notificationService");

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
    const selectedFields =
      "userId paidLeaveDays unpaidLeaveDays startDate endDate status reason";
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

    const error = new Error("Bạn không có quyền xem yêu cầu nghỉ phép này");
    error.statusCode = 403;
    throw error;
  }

  async getLeaveRequestById({ tenantId, user, leaveRequestId }) {
    if (!mongoose.Types.ObjectId.isValid(leaveRequestId)) {
      const error = new Error("Mã yêu cầu nghỉ phép không hợp lệ");
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
      let error = new Error("Không tìm thấy yêu cầu nghỉ phép");
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

  calculateLeaveDays(startDate, endDate) {
    const startWorkDate = this.buildWorkDate(startDate);
    const endWorkDate = this.buildWorkDate(endDate);

    if (startWorkDate > endWorkDate) {
      const error = new Error("Ngày kết thúc không được trước ngày bắt đầu");
      error.statusCode = 400;
      throw error;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((endWorkDate - startWorkDate) / millisecondsPerDay) + 1;
  }

  async getLeaveBalance({ tenantId, userId }) {
    const user = await User.findOne({
      _id: userId,
      tenantId,
      status: { $ne: "DELETED" },
    })
      .select("leaveBalance")
      .lean();

    if (!user) {
      const error = new Error("Không tìm thấy nhân viên");
      error.statusCode = 404;
      throw error;
    }

    const annualLeaveDays = user.leaveBalance?.annualLeaveDays ?? 12;
    const remainingDays = user.leaveBalance?.remainingDays ?? annualLeaveDays;

    return {
      annualLeaveDays,
      remainingDays,
      usedDays: annualLeaveDays - remainingDays,
    };
  }

  async assertAnnualLeaveBalance({ tenantId, userId, requestedDays, session }) {
    const user = await User.findOne({
      _id: userId,
      tenantId,
      status: { $ne: "DELETED" },
    })
      .select("leaveBalance")
      .session(session);

    if (!user) {
      const error = new Error("Không tìm thấy nhân viên");
      error.statusCode = 404;
      throw error;
    }

    const annualLeaveDays = user.leaveBalance?.annualLeaveDays ?? 12;
    const remainingDays = user.leaveBalance?.remainingDays ?? annualLeaveDays;

    if (
      user.leaveBalance?.annualLeaveDays === undefined ||
      user.leaveBalance?.remainingDays === undefined
    ) {
      await User.updateOne(
        { _id: userId, tenantId },
        {
          $set: {
            "leaveBalance.annualLeaveDays": annualLeaveDays,
            "leaveBalance.remainingDays": remainingDays,
          },
        },
        { session },
      );
    }

    if (remainingDays < requestedDays) {
      const error = new Error("Số ngày nghỉ phép có lương còn lại không đủ");
      error.statusCode = 400;
      throw error;
    }

    return { annualLeaveDays, remainingDays };
  }

  getPreviewDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
      const error = new Error("Ngày bắt đầu và ngày kết thúc là bắt buộc");
      error.statusCode = 400;
      throw error;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const error = new Error("Khoảng thời gian nghỉ phép không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const startWorkDate = this.buildWorkDate(startDate);
    const endWorkDateExclusive = this.buildWorkDate(endDate);
    endWorkDateExclusive.setUTCDate(endWorkDateExclusive.getUTCDate() + 1); // append one day to enddate to... 2026-07-1T00:00:00.000Z <= date < 2026-07-2T00:00:00.000Z

    if (startWorkDate >= endWorkDateExclusive) {
      const error = new Error("Ngày kết thúc không được trước ngày bắt đầu");
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
        message: "Người dùng hiện tại không cần bàn giao lịch làm việc",
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
        "Cần chọn nhân viên nhận bàn giao vì quản lý có lịch làm việc trong thời gian nghỉ",
      );
      error.statusCode = 400;
      throw error;
    }

    if (this.sameId(manager.userId, handoverToUserId)) {
      const error = new Error("Quản lý không thể bàn giao lịch cho chính mình");
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
      const error = new Error(
        "Không tìm thấy nhân viên nhận bàn giao hoặc tài khoản không hoạt động",
      );
      error.statusCode = 404;
      throw error;
    }

    if (
      manager.role === "BRANCH_MANAGER" &&
      !this.sameId(handoverUser.branchId, manager.branchId)
    ) {
      const error = new Error(
        "Nhân viên nhận bàn giao phải thuộc cùng chi nhánh",
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      manager.role === "WAREHOUSE_MANAGER" &&
      !this.sameId(handoverUser.warehouseId, manager.warehouseId)
    ) {
      const error = new Error("Nhân viên nhận bàn giao phải thuộc cùng kho");
      error.statusCode = 400;
      throw error;
    }

    return handoverUser;
  }

  async checkOverlappingLeaveRequest({
    tenantId,
    userId,
    startDate,
    endDate,
    excludeLeaveRequestId = null,
  }) {
    const filter = {
      tenantId,
      userId,
      status: { $in: ["PENDING", "APPROVED"] },
      startDate: { $lte: new Date(endDate) },
      endDate: { $gte: new Date(startDate) },
    };

    if (excludeLeaveRequestId) {
      filter._id = { $ne: excludeLeaveRequestId };
    }

    const overlap = await LeaveRequest.findOne(filter)
      .select("_id startDate endDate status paidLeaveDays unpaidLeaveDays")
      .lean();

    if (overlap) {
      const error = new Error(
        "Tìm thấy yêu cầu nghỉ phép trùng lặp với khoảng thời gian đã chọn",
      );
      error.statusCode = 409;
      error.data = overlap;
      throw error;
    }
  }

  //=============================================================================================
  //===========================Main Services ========================================================
  //=============================================================================================

  async createLeaveRequest({ tenantId, userId, leaveRequestData, user }) {
    const leaveRequest = new CreateLeaveRequestDTO(
      tenantId,
      userId,
      leaveRequestData,
    );
    const validation = leaveRequest.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu không hợp lệ");
      error.statusCode = validation.statusCode || 400;
      error.errors = validation.errors;
      throw error;
    }

    const isManagerLeave = this.isManager(user, userId);

    if (!isManagerLeave && leaveRequest.handoverToUserId) {
      let error = new Error(
        "Chỉ quản lý mới được chọn nhân viên nhận bàn giao cho đơn nghỉ của chính mình",
      );
      error.statusCode = 400;
      throw error;
    }

    await this.checkOverlappingLeaveRequest({
      tenantId,
      userId,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
    });

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

          affectedScheduleIds = affectedSchedules.map(
            (schedule) => schedule._id,
          );
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

    // Báo cho người duyệt. Đặt NGOÀI transaction: nếu gửi noti lỗi thì đơn nghỉ
    // phép vẫn phải được tạo. notify() tự nuốt lỗi nên không cần try/catch ở đây.
    const approvers = await NotificationService.approversOf({
      ...user,
      tenantId,
      _id: userId,
    });
    const requesterName = await NotificationService.displayName(userId);

    await NotificationService.notify({
      tenantId,
      recipientIds: approvers,
      type: "LEAVE_REQUEST_CREATED",
      title: "Đơn nghỉ phép mới",
      description: `${requesterName} đã gửi đơn nghỉ phép chờ bạn duyệt.`,
      link: `/staffs/schedule/leave-requests/${createdLeaveRequest?._id}`,
      referenceId: createdLeaveRequest?._id,
    });

    return {
      statusCode: validation.statusCode,
      success: true,
      message: "Tạo yêu cầu nghỉ phép thành công",
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
      let error = new Error("Không tìm thấy yêu cầu nghỉ phép");
      error.statusCode = 404;
      throw error;
    }
    const updateDTO = new UpdateLeaveRequestDTO(leaveRequestData);
    const validation = updateDTO.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu không hợp lệ");
      error.statusCode = validation.statusCode || 400;
      error.errors = validation.errors;
      throw error;
    }

    const updateData = updateDTO.toUpdateData();

    const startDate = updateData.startDate || leaveRequest.startDate;
    const endDate = updateData.endDate || leaveRequest.endDate;

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      const error = new Error("Ngày kết thúc không được trước ngày bắt đầu");
      error.statusCode = 400;
      throw error;
    }

    await this.checkOverlappingLeaveRequest({
      tenantId,
      userId: leaveRequest.userId,
      startDate,
      endDate,
      excludeLeaveRequestId: leaveRequestId,
    });

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
      let error = new Error("Người duyệt không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    if (
      data.status === "REJECTED" &&
      (!data.reviewNote ||
        typeof data.reviewNote !== "string" ||
        data.reviewNote.trim() === "")
    ) {
      let error = new Error("Cần nhập ghi chú khi từ chối yêu cầu nghỉ phép");
      error.statusCode = 400;
      throw error;
    }

    if (!data.status || !["APPROVED", "REJECTED"].includes(data.status)) {
      let error = new Error("Trạng thái duyệt phải là APPROVED hoặc REJECTED");
      error.statusCode = 400;
      throw error;
    }

    const updateDTO = new UpdateLeaveRequestDTO(data);
    const validation = updateDTO.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu không hợp lệ");
      error.statusCode = validation.statusCode || 400;
      error.errors = validation.errors;
      throw error;
    }

    const session = await mongoose.startSession();
    let leaveRequest;

    try {
      await session.withTransaction(async () => {
        const currentLeaveRequest = await LeaveRequest.findOne({
          _id: leaveRequestId,
          tenantId,
        }).session(session);

        if (!currentLeaveRequest) {
          let error = new Error("Không tìm thấy yêu cầu nghỉ phép");
          error.statusCode = 404;
          throw error;
        }

        if (currentLeaveRequest.status !== "PENDING") {
          let error = new Error("Chỉ có thể duyệt yêu cầu đang chờ xử lý");
          error.statusCode = 400;
          throw error;
        }

        if (data.status === "APPROVED") {
          if (
            updateDTO.paidLeaveDays === undefined ||
            updateDTO.unpaidLeaveDays === undefined
          ) {
            const error = new Error(
              "Cần nhập số ngày nghỉ có lương và không lương khi duyệt",
            );
            error.statusCode = 400;
            throw error;
          }

          const totalApprovedDays =
            updateDTO.paidLeaveDays + updateDTO.unpaidLeaveDays;
          const totalLeaveDays = this.calculateLeaveDays(
            currentLeaveRequest.startDate,
            currentLeaveRequest.endDate,
          );

          if (totalApprovedDays <= 0) {
            const error = new Error(
              "Tổng số ngày nghỉ được duyệt phải lớn hơn 0",
            );
            error.statusCode = 400;
            throw error;
          }

          if (totalApprovedDays > totalLeaveDays) {
            const error = new Error(
              "Tổng số ngày nghỉ có lương và không lương không được vượt quá số ngày xin nghỉ",
            );
            error.statusCode = 400;
            throw error;
          }

          if (updateDTO.paidLeaveDays > 0) {
            await this.assertAnnualLeaveBalance({
              tenantId,
              userId: currentLeaveRequest.userId,
              requestedDays: updateDTO.paidLeaveDays,
              session,
            });

            const updatedUser = await User.findOneAndUpdate(
              {
                _id: currentLeaveRequest.userId,
                tenantId,
                "leaveBalance.remainingDays": { $gte: updateDTO.paidLeaveDays },
              },
              {
                $inc: {
                  "leaveBalance.remainingDays": -updateDTO.paidLeaveDays,
                },
              },
              { new: true, session },
            );

            if (!updatedUser) {
              const error = new Error(
                "Số ngày nghỉ phép có lương còn lại không đủ",
              );
              error.statusCode = 400;
              throw error;
            }
          }
        }

        leaveRequest = await LeaveRequest.findOneAndUpdate(
          { _id: leaveRequestId, tenantId },
          { $set: updateDTO.toUpdateData() },
          { new: true, runValidators: true, session },
        )
          .select("-__v")
          .lean();
      });
    } finally {
      await session.endSession();
    }

    // Báo kết quả về cho chính người nộp đơn.
    const approved = leaveRequest?.status === "APPROVED";

    await NotificationService.notify({
      tenantId,
      recipientIds: [leaveRequest?.userId],
      type: approved ? "LEAVE_REQUEST_APPROVED" : "LEAVE_REQUEST_REJECTED",
      title: approved ? "Đơn nghỉ phép được duyệt" : "Đơn nghỉ phép bị từ chối",
      description: approved
        ? "Đơn nghỉ phép của bạn đã được duyệt."
        : `Đơn nghỉ phép của bạn đã bị từ chối.${
            leaveRequest?.reviewNote ? ` Lý do: ${leaveRequest.reviewNote}` : ""
          }`,
      link: `/staffs/schedule/leave-requests/${leaveRequestId}`,
      referenceId: leaveRequestId,
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
      let error = new Error("Không tìm thấy yêu cầu nghỉ phép");
      error.statusCode = 404;
      throw error;
    }

    if (userId && leaveRequest.userId.toString() !== userId.toString()) {
      let error = new Error(
        "Bạn chỉ có thể hủy yêu cầu nghỉ phép của chính mình",
      );
      error.statusCode = 403;
      throw error;
    }

    if (!["PENDING", "APPROVED"].includes(leaveRequest.status)) {
      let error = new Error(
        "Chỉ có thể hủy yêu cầu đang chờ xử lý hoặc đã được duyệt",
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
        "Không thể hủy yêu cầu nghỉ phép khi ngày nghỉ đã bắt đầu",
      );
      error.statusCode = 400;
      throw error;
    }

    data.status = "CANCELLED";
    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        if (
          leaveRequest.status === "APPROVED" &&
          leaveRequest.paidLeaveDays > 0
        ) {
          await User.updateOne(
            { _id: leaveRequest.userId, tenantId },
            {
              $inc: {
                "leaveBalance.remainingDays": leaveRequest.paidLeaveDays,
              },
            },
            { session },
          );
        }

        result = await LeaveRequest.findOneAndUpdate(
          { _id: leaveRequestId, tenantId },
          { $set: data },
          { new: true, runValidators: true, session },
        )
          .select("-__v")
          .lean();
      });
    } finally {
      await session.endSession();
    }

    // Người duyệt cần biết đơn đã bị rút — nhất là đơn đã APPROVED, vì lịch làm
    // việc có thể đã được sắp xếp lại quanh nó. Đơn đã huỷ và commit xong rồi,
    // nên lỗi khi gửi thông báo chỉ được log, không ném lên.
    try {
      const requester = await User.findById(leaveRequest.userId)
        .select("role branchId tenantId")
        .lean();

      const approvers = await NotificationService.approversOf({
        ...requester,
        _id: leaveRequest.userId,
        tenantId,
      });
      const requesterName = await NotificationService.displayName(
        leaveRequest.userId,
      );

      await NotificationService.notify({
        tenantId,
        recipientIds: approvers,
        type: "LEAVE_REQUEST_CANCELLED",
        title: "Đơn nghỉ phép đã bị hủy",
        description: `${requesterName} đã hủy đơn nghỉ phép.`,
        link: `/staffs/schedule/leave-requests/${leaveRequestId}`,
        referenceId: leaveRequestId,
      });
    } catch (error) {
      console.error(
        "[LeaveRequestService] Không gửi được thông báo hủy đơn:",
        error.message,
      );
    }

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
      message: "Xóa yêu cầu nghỉ phép thành công",
      result,
    };
  }
}
module.exports = new LeaveRequestService();

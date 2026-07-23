const BaseService = require("../../../common/services/baseService");
const { Attendance, User, WorkingSchedule } = require("../../../models");
const {
  assertAttendanceCanChange,
} = require("./PayrollAttendancePolicy");

class ManageAttendanceService extends BaseService {
  sameId(left, right) {
    return left?.toString() === right?.toString();
  }

  assertCanReadAttendance(user, attendance) {
    const targetUser = attendance.userId;

    if (this.sameId(targetUser?._id || targetUser, user.userId)) {
      return;
    }

    if (user.role === "TENANT_OWNER") {
      return;
    }

    if (
      user.role === "BRANCH_MANAGER" &&
      !targetUser?.warehouseId &&
      this.sameId(targetUser?.branchId?._id || targetUser?.branchId, user.branchId)
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

    const error = new Error("You do not have permission to read this attendance");
    error.statusCode = 403;
    throw error;
  }

  assertCanManuallyCheckout(user, attendance) {
    const managerRoles = ["TENANT_OWNER", "BRANCH_MANAGER"];
    if (!managerRoles.includes(user.role)) {
      const error = new Error("Bạn không có quyền sửa chấm công thủ công");
      error.statusCode = 403;
      throw error;
    }

    if (this.sameId(attendance.userId?._id || attendance.userId, user.userId)) {
      const error = new Error("Quản lý không thể tự sửa chấm công của chính mình");
      error.statusCode = 403;
      throw error;
    }

    this.assertCanReadAttendance(user, attendance);
  }

  parseBoolean(value) {
    return value === true || value === "true";
  }

  buildDateRangeFilter(from, to) {
    const dateFilter = {};

    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        throw new Error("Ngày bắt đầu không hợp lệ");
      }
      dateFilter.$gte = fromDate;
    }

    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        throw new Error("Ngày kết thúc không hợp lệ");
      }
      dateFilter.$lte = toDate;
    }

    return Object.keys(dateFilter).length ? dateFilter : null;
  }

  async buildFilter(filter = {}) {
    const {
      userId,
      scheduleId,
      status,
      checkinFrom,
      checkinTo,
      checkoutFrom,
      checkoutTo,
      lateOnly,
      overtimeOnly,
      missingCheckout,
      branchId,
      warehouseId,
    } = filter;
    const baseFilter = { tenantId: filter.tenantId };

    if (userId) baseFilter.userId = userId;
    if (scheduleId) baseFilter.scheduleId = scheduleId;

    if (branchId || warehouseId) {
      const userFilter = {
        tenantId: filter.tenantId,
        status: { $ne: "DELETED" },
      };

      if (branchId) userFilter.branchId = branchId;
      if (warehouseId) userFilter.warehouseId = warehouseId;

      const users = await User.find(userFilter).select("_id").lean();
      const userIds = users.map((user) => user._id);

      baseFilter.userId = userId
        ? { $in: userIds.filter((id) => String(id) === String(userId)) }
        : { $in: userIds };
    }

    if (status) {
      const normalizedStatus = String(status).trim().toUpperCase();
      const allowedStatuses = ["CHECKED_IN", "CHECKED_OUT", "ABSENT"];

      if (!allowedStatuses.includes(normalizedStatus)) {
        throw new Error(
          `Invalid attendance status. Allowed statuses: ${allowedStatuses.join(", ")}`,
        );
      }

      baseFilter.status = normalizedStatus;
    }

    const checkinRange = this.buildDateRangeFilter(checkinFrom, checkinTo);
    if (checkinRange) {
      baseFilter.actualCheckinAt = checkinRange;
    }

    if (this.parseBoolean(missingCheckout)) {
      if (checkoutFrom || checkoutTo) {
        throw new Error("Cannot filter missing checkout with checkout date range");
      }

      baseFilter.actualCheckoutAt = null;
      baseFilter.status = "CHECKED_IN";
    } else {
      const checkoutRange = this.buildDateRangeFilter(checkoutFrom, checkoutTo);
      if (checkoutRange) {
        baseFilter.actualCheckoutAt = checkoutRange;
      }
    }

    if (this.parseBoolean(lateOnly)) {
      baseFilter.lateMinutes = { $gt: 0 };
    }

    if (this.parseBoolean(overtimeOnly)) {
      baseFilter.overtimeMinute = { $gt: 0 };
    }

    return baseFilter;
  }

  async fetchUserAttendances(
    filter,
    selectFields,
    populateFields = [],
    pagination,
  ) {
    const [data, total] = await Promise.all([
      Attendance.find(filter)
        .populate(populateFields)
        .select(selectFields)
        .skip(pagination.skip)
        .limit(pagination.recordPerPage)
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: pagination.page,
        recordPerPage: pagination.recordPerPage,
        totalPages: Math.ceil(total / pagination.recordPerPage),
      },
    };
  }

  //==============================================================================
  //============================== Services methods ==============================
  //==============================================================================
  async getAttendances(tenantId, filter) {
    await this.validateTenantId(tenantId);
    const pagination = this.getPagination(filter);
    const attendanceFilter = await this.buildFilter({ ...filter, tenantId });
    const receiveFields = [
      "_id",
      "userId",
      "scheduleId",
      "actualCheckinAt",
      "actualCheckoutAt",
      "lateMinutes",
      "overtimeMinute",
      "status",
    ];

    const populateFields = [
      {
        path: "scheduleId",
        select: ["_id", "workDate", "startAt", "endAt", "shiftTemplateId"],
        populate: {
          path: "shiftTemplateId",
          select: ["_id", "name", "startTime", "endTime"],
        },
      },
    ];

    return await this.fetchUserAttendances(
      attendanceFilter,
      receiveFields,
      populateFields,
      pagination,
    );
  }

  async getAttendanceById(tenantId, attendanceId, user) {
    await this.validateTenantId(tenantId);
    const detailFields = [
      "_id",
      "userId",
      "scheduleId",
      "actualCheckinAt",
      "actualCheckoutAt",
      "workedMinutes",
      "overtimeMinute",
      "lateMinutes",
      "status",
      "checkInLocation",
      "checkOutLocation",
      "createdAt",
      "updatedAt",
      "manuallyEditedBy",
      "manuallyEditedAt",
      "manualEditReason",
    ];

    const detailPopulateFields = [
      {
        path: "scheduleId",
        select: [
          "_id",
          "workDate",
          "startAt",
          "endAt",
          "status",
          "shiftTemplateId",
        ],
        populate: {
          path: "shiftTemplateId",
          select: ["_id", "name", "startTime", "endTime"],
        },
      },
      {
        path: "userId",
        select: [
          "_id",
          "phoneNumber",
          "email",
          "role",
          "profile",
          "branchId",
          "warehouseId",
        ],
        populate: [
          {
            path: "branchId",
            select: ["_id", "name", "address"],
          },
          {
            path: "warehouseId",
            select: ["_id", "name", "address"],
          },
        ],
      },
    ];

    const attendanceFilter = {
      tenantId,
      _id: attendanceId,
    };

    const attendance = await Attendance.findOne(attendanceFilter)
      .populate(detailPopulateFields)
      .select(detailFields)
      .lean();

    if (!attendance) {
      const error = new Error("Attendance not found");
      error.statusCode = 404;
      throw error;
    }

    this.assertCanReadAttendance(user, attendance);

    return attendance;
  }

  async manualCheckout(tenantId, attendanceId, dto, manager) {
    await this.validateTenantId(tenantId);
    const attendance = await Attendance.findOne({ tenantId, _id: attendanceId })
      .populate({
        path: "userId",
        select: "_id branchId warehouseId",
      });

    if (!attendance) {
      const error = new Error("Attendance not found");
      error.statusCode = 404;
      throw error;
    }

    this.assertCanManuallyCheckout(manager, attendance);

    if (attendance.status !== "CHECKED_IN" || !attendance.actualCheckinAt) {
      const error = new Error("Chỉ có thể bổ sung checkout cho bản ghi đang CHECKED_IN");
      error.statusCode = 409;
      throw error;
    }
    if (dto.actualCheckoutAt <= attendance.actualCheckinAt) {
      const error = new Error("Giờ check-out phải sau giờ check-in");
      error.statusCode = 422;
      throw error;
    }
    if (dto.actualCheckoutAt > new Date()) {
      const error = new Error("Giờ check-out không thể ở tương lai");
      error.statusCode = 422;
      throw error;
    }

    await assertAttendanceCanChange(tenantId, attendance.workDate);

    attendance.actualCheckoutAt = dto.actualCheckoutAt;
    attendance.workedMinutes = Math.floor(
      (dto.actualCheckoutAt.getTime() - attendance.actualCheckinAt.getTime()) /
        60000,
    );
    attendance.status = "CHECKED_OUT";
    attendance.manuallyEditedBy = manager.userId;
    attendance.manuallyEditedAt = new Date();
    attendance.manualEditReason = dto.reason;
    await attendance.save();

    return attendance;
  }

  async createManualAttendance(tenantId, dto, manager) {
    await this.validateTenantId(tenantId);
    const [schedule, targetUser] = await Promise.all([
      WorkingSchedule.findOne({
        _id: dto.scheduleId,
        tenantId,
        userId: dto.userId,
        status: { $in: ["SCHEDULED", "COMPLETED"] },
      }).lean(),
      User.findOne({ _id: dto.userId, tenantId })
        .select("_id branchId warehouseId")
        .lean(),
    ]);

    if (!schedule || !targetUser) {
      const error = new Error("Không tìm thấy ca làm việc của nhân viên");
      error.statusCode = 404;
      throw error;
    }

    this.assertCanManuallyCheckout(manager, { userId: targetUser });
    const now = new Date();
    await assertAttendanceCanChange(tenantId, schedule.workDate);

    if (dto.status === "ABSENT") {
      if (!schedule.endAt || new Date(schedule.endAt) > now) {
        const error = new Error("Chỉ được đánh dấu vắng sau khi ca kết thúc");
        error.statusCode = 422;
        throw error;
      }
    } else {
      const earliestCheckin = new Date(schedule.startAt).getTime() - 30 * 60000;
      if (dto.actualCheckinAt.getTime() < earliestCheckin) {
        const error = new Error("Giờ check-in sớm hơn thời gian cho phép của ca");
        error.statusCode = 422;
        throw error;
      }
      if (dto.actualCheckinAt > now) {
        const error = new Error("Giờ check-in không thể ở tương lai");
        error.statusCode = 422;
        throw error;
      }
      if (
        dto.actualCheckoutAt &&
        (dto.actualCheckoutAt <= dto.actualCheckinAt ||
          dto.actualCheckoutAt > now)
      ) {
        const error = new Error(
          "Giờ check-out phải sau check-in và không được ở tương lai",
        );
        error.statusCode = 422;
        throw error;
      }
    }

    try {
      const attendance = await Attendance.create({
        tenantId,
        userId: dto.userId,
        scheduleId: schedule._id,
        workDate: schedule.workDate,
        actualCheckinAt: dto.status === "ABSENT" ? undefined : dto.actualCheckinAt,
        actualCheckoutAt:
          dto.status === "CHECKED_OUT" ? dto.actualCheckoutAt : undefined,
        workedMinutes:
          dto.status === "CHECKED_OUT"
            ? Math.floor(
                (dto.actualCheckoutAt.getTime() -
                  dto.actualCheckinAt.getTime()) /
                  60000,
              )
            : dto.status === "ABSENT"
              ? 0
              : undefined,
        status: dto.status,
        manuallyCreatedBy: manager.userId,
        manuallyCreatedAt: now,
        manualCreationReason: dto.reason,
      });
      return attendance;
    } catch (error) {
      if (error?.code === 11000) {
        const conflict = new Error("Nhân viên đã có chấm công cho ca này");
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }
}

module.exports = { ManageAttendanceService };

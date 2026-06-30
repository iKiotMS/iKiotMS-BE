const { STAFF_ROLES } = require("../../../constants/role");
const Attendance = require("../../../models/Attendance");
const ShiftTemplate = require("../../../models/ShiftTemplate");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");
const { BulkWorkingScheduleDTO } = require("../dto/WorkingScheduleDTO");

class WorkingScheduleService {
  //===============================================================================================================================================================================
  //===================================================================    Helper Functions    ====================================================================================
  //===============================================================================================================================================================================

  // Chuẩn hóa page/recordPerPage và tính số record cần bỏ qua.
  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  // Lấy phần YYYY-MM-DD từ date string hoặc Date.
  getLocalDateText(dateValue) {
    if (typeof dateValue === "string") {
      return dateValue.slice(0, 10);
    }

    return dateValue.toISOString().slice(0, 10);
  }

  // Ghép ngày làm việc + giờ ca mẫu thành Date đầy đủ.
  buildDateTime(workDate, timeText) {
    const dateText = this.getLocalDateText(workDate);
    return new Date(`${dateText}T${timeText}:00.000Z`);
  }

  // Lưu ngày làm việc ở mốc 00:00 UTC để ISO string giữ nguyên ngày FE gửi.
  buildWorkDate(workDate) {
    const dateText = this.getLocalDateText(workDate);
    return new Date(`${dateText}T00:00:00.000Z`);
  }

  // Kiểm tra tất cả userId được phân ca có thuộc tenant và là staff hợp lệ.
  async validateTenantStaff(tenantId, userIds, userRole) {
    const uniqueUserIds = [...new Set(userIds.flat().map(String))];

    const users = await User.find({
      _id: { $in: uniqueUserIds },
      tenantId,
      role: { $in: STAFF_ROLES },
      status: "ACTIVE",
    }).select("_id role");

    if (users.length !== uniqueUserIds.length) {
      const error = new Error("Một hoặc nhiều nhân viên không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    users.forEach((user) => {
      if (validateRoleHierarchy(userRole, user.role) === false) {
        const error = new Error(
          `Vai trò ${userRole} không có quyền phân ca cho nhân viên có vai trò ${user.role}`,
        );
        error.statusCode = 403;
        throw error;
      }
    });
  }

  normalizeScheduleUserIds(userId) {
    const userIds = Array.isArray(userId) ? userId : [userId];
    return [...new Set(userIds.filter(Boolean).map(String))];
  }

  // Lấy các ca mẫu theo tenant, sau đó gom lại theo id để tra cứu nhanh.
  async getTenantShiftTemplates(tenantId, shiftTemplateIds) {
    const uniqueShiftTemplateIds = [...new Set(shiftTemplateIds.map(String))];

    const shiftTemplates = await ShiftTemplate.find({
      _id: { $in: shiftTemplateIds },
      tenantId,
      status: "ACTIVE",
    });

    if (shiftTemplates.length !== uniqueShiftTemplateIds.length) {
      const error = new Error("Một hoặc nhiều ca mẫu không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const shiftTemplatesById = {};

    shiftTemplates.forEach((shiftTemplate) => {
      const shiftTemplateId = String(shiftTemplate._id);
      shiftTemplatesById[shiftTemplateId] = shiftTemplate;
    });

    // {
    //   "shiftTemplateId1": shiftTemplateObject,
    //   "shiftTemplateId2": shiftTemplateObject
    // }
    return shiftTemplatesById;
  }

  async checkScheduleOverlaps(tenantId, schedules, ScheduleIdToExclude = null) {
    const expandedSchedules = [];

    schedules.forEach((schedule) => {
      const userIds = this.normalizeScheduleUserIds(schedule.userId);

      userIds.forEach((userId) => {
        expandedSchedules.push({
          ...schedule,
          userId,
          scheduleIdToExclude:
            schedule.scheduleIdToExclude || ScheduleIdToExclude,
        });
      });
    });

    for (let i = 0; i < expandedSchedules.length; i++) {
      const current = expandedSchedules[i];

      for (let j = i + 1; j < expandedSchedules.length; j++) {
        const next = expandedSchedules[j];

        const sameUser = String(current.userId) === String(next.userId);
        const isOverlapping =
          current.startAt < next.endAt && current.endAt > next.startAt;
        const sameScheduleTime =
          String(current.shiftTemplateId) === String(next.shiftTemplateId) &&
          Number(current.workDate) === Number(next.workDate) &&
          Number(current.startAt) === Number(next.startAt) &&
          Number(current.endAt) === Number(next.endAt);

        if (sameUser && isOverlapping && !sameScheduleTime) {
          const error = new Error(
            `Lịch làm việc bị trùng ca mẫu cho nhân viên ${current.userId} vào ngày ${this.getLocalDateText(current.workDate)}`,
          );
          error.statusCode = 400;
          error.duplicatedWorkingSchedule = {
            current,
            duplicated: next,
          };
          throw error;
        }
      }
    }

    for (const schedule of expandedSchedules) {
      const filter = {
        tenantId,
        userId: schedule.userId,
        status: { $nin: ["CANCELLED", "DELETED"] },
        startAt: { $lt: schedule.endAt },
        endAt: { $gt: schedule.startAt },
      };

      if (schedule.scheduleIdToExclude) {
        filter._id = { $ne: schedule.scheduleIdToExclude };
      }

      const existingSchedule = await WorkingSchedule.findOne(filter)
        .populate("userId", "phoneNumber profile role")
        .populate("shiftTemplateId")
        .lean();

      if (existingSchedule) {
        const error = new Error(
          "Nhân viên đã có lịch làm việc bị trùng thời gian",
        );
        error.statusCode = 400;
        error.duplicatedWorkingSchedule = existingSchedule;
        throw error;
      }
    }
  }

  configWorkAndEndDate(workDate, shiftTemplate) {
    const startTime = shiftTemplate.startTime;
    const endTime = shiftTemplate.endTime;

    const startAt = this.buildDateTime(workDate, startTime);
    const endAt = this.buildDateTime(workDate, endTime);

    if (startTime > endTime) {
      endAt.setUTCDate(endAt.getUTCDate() + 1);
    }

    return { startAt, endAt };
  }

  buildAttendanceSummary(attendance) {
    if (!attendance) {
      return {
        status: "NOT_CHECKED_IN",
        actualCheckinAt: null,
        actualCheckoutAt: null,
      };
    }

    return {
      _id: attendance._id,
      status: attendance.status,
      actualCheckinAt: attendance.actualCheckinAt || null,
      actualCheckoutAt: attendance.actualCheckoutAt || null,
    };
  }

  buildAttendanceDetail(attendance) {
    if (!attendance) {
      return {
        status: "NOT_CHECKED_IN",
        actualCheckinAt: null,
        actualCheckoutAt: null,
      };
    }

    return {
      _id: attendance._id,
      status: attendance.status,
      actualCheckinAt: attendance.actualCheckinAt || null,
      actualCheckoutAt: attendance.actualCheckoutAt || null,
      checkInLocation: attendance.checkInLocation || null,
      checkOutLocation: attendance.checkOutLocation || null,
      workedMinutes: attendance.workedMinutes,
      overtimeMinute: attendance.overtimeMinute,
      lateMinutes: attendance.lateMinutes,
    };
  }

  getScheduleUsers(schedule) {
    if (Array.isArray(schedule.userId)) {
      return schedule.userId;
    }

    if (schedule.userId) {
      return [schedule.userId];
    }

    return [];
  }

  getUserIdText(user) {
    return String(user?._id || user);
  }

  getAttendanceKey(scheduleId, userId) {
    return `${String(scheduleId)}:${String(userId)}`;
  }

  attachAttendancesToUsers(schedules, attendanceByScheduleAndUser, detail) {
    return schedules.map((schedule) => {
      const users = this.getScheduleUsers(schedule);
      const usersWithAttendance = users.map((user) => {
        const userId = this.getUserIdText(user);
        const attendance =
          attendanceByScheduleAndUser[
            this.getAttendanceKey(schedule._id, userId)
          ];

        if (typeof user === "object" && user !== null) {
          return {
            ...user,
            attendance: detail
              ? this.buildAttendanceDetail(attendance)
              : this.buildAttendanceSummary(attendance),
          };
        }

        return {
          _id: user,
          attendance: detail
            ? this.buildAttendanceDetail(attendance)
            : this.buildAttendanceSummary(attendance),
        };
      });

      return {
        ...schedule,
        userId: Array.isArray(schedule.userId)
          ? usersWithAttendance
          : usersWithAttendance[0] || null,
      };
    });
  }

  async attachAttendanceSummaries(tenantId, schedules, detail = false) {
    const scheduleIds = schedules.map((schedule) => schedule._id);
    const selectFields = detail
      ? "scheduleId userId status actualCheckinAt actualCheckoutAt checkInLocation checkOutLocation workedMinutes overtimeMinute lateMinutes"
      : "scheduleId userId status actualCheckinAt actualCheckoutAt";

    const attendances = await Attendance.find({
      tenantId,
      scheduleId: { $in: scheduleIds },
    })
      .select(selectFields)
      .lean();

    const attendanceByScheduleAndUser = {};
    attendances.forEach((attendance) => {
      attendanceByScheduleAndUser[
        this.getAttendanceKey(attendance.scheduleId, attendance.userId)
      ] = attendance;
    });

    return this.attachAttendancesToUsers(
      schedules,
      attendanceByScheduleAndUser,
      detail,
    );
  }

  async fetchWorkingSchedules({
    tenantId,
    query,
    selectedFields,
    populatedFields,
    page,
    recordPerPage,
    detail = false,
  }) {
    let filter = { tenantId, status: { $ne: "DELETED" } };
    const pagination = this.getPagination({ page, recordPerPage });

    if (query._id) filter._id = query._id;

    if (query.userId) filter.userId = query.userId;

    if (query.status) {
      const status = String(query.status).trim().toUpperCase();
      const allowedStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];

      if (!allowedStatuses.includes(status)) {
        const error = new Error("Trạng thái lịch làm việc không hợp lệ");
        error.statusCode = 400;
        throw error;
      }

      filter.status = status;
    }

    if (query.startDate || query.endDate) {
      filter.workDate = {};

      if (
        query.startDate &&
        Number.isNaN(new Date(query.startDate).getTime())
      ) {
        const error = new Error(
          "Ngày bắt đầu không hợp lệ, hãy nhập(YYYY-MM-DD)",
        );
        error.statusCode = 400;
        throw error;
      }

      if (query.endDate && Number.isNaN(new Date(query.endDate).getTime())) {
        const error = new Error(
          "Ngày kết thúc không hợp lệ, hãy nhập(YYYY-MM-DD)",
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        query.startDate &&
        query.endDate &&
        new Date(query.startDate) > new Date(query.endDate)
      ) {
        const error = new Error(
          "Ngày bắt đầu không được lớn hơn ngày kết thúc",
        );
        error.statusCode = 400;
        throw error;
      }

      if (query.startDate) {
        filter.workDate.$gte = this.buildWorkDate(query.startDate);
      }

      if (query.endDate) {
        let endDateExclusive = this.buildWorkDate(query.endDate);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        filter.workDate.$lt = endDateExclusive;
      }
    }

    const [workingSchedules, total] = await Promise.all([
      WorkingSchedule.find(filter)
        .populate(populatedFields)
        .select(selectedFields)
        .sort({ workDate: 1, startAt: 1 })
        .skip(pagination.skip)
        .limit(pagination.recordPerPage)
        .lean(),
      WorkingSchedule.countDocuments(filter),
    ]);

    const data = await this.attachAttendanceSummaries(
      tenantId,
      workingSchedules,
      detail,
    );

    return {
      workingSchedules: data,
      pagination: {
        total,
        page: pagination.page,
        recordPerPage: pagination.recordPerPage,
        totalPage: Math.ceil(total / pagination.recordPerPage),
      },
    };
  }

  //===============================================================================================================================================================================
  //===============================================================    Main Services    ===========================================================================================
  //===============================================================================================================================================================================

  // Nhận danh sách phân ca từ FE, validate, tính startAt/endAt rồi insert nhiều record.
  async createBulkWorkingSchedules(tenantId, createdBy, data, userRole) {
    const dto = new BulkWorkingScheduleDTO(tenantId, createdBy, data);
    const validation = dto.validate();

    if (!validation.isValid) {
      const error = new Error(validation.errors.join("; "));
      error.statusCode = validation.statusCode;
      throw error;
    }

    const userIds = dto.schedules.flatMap((schedule) => {
      return this.normalizeScheduleUserIds(schedule.userId);
    });

    await this.validateTenantStaff(tenantId, userIds, userRole);

    const shiftTemplateIds = dto.schedules.map((schedule) => {
      return schedule.shiftTemplateId;
    });

    const shiftTemplatesById = await this.getTenantShiftTemplates(
      tenantId,
      shiftTemplateIds,
    );

    const schedules = dto.schedules.map((schedule) => {
      const shiftTemplateId = String(schedule.shiftTemplateId);
      const shiftTemplate = shiftTemplatesById[shiftTemplateId];
      const workDate = this.buildWorkDate(schedule.workDate);
      const { startAt, endAt } = this.configWorkAndEndDate(
        schedule.workDate,
        shiftTemplate,
      );
      const scheduleUserIds = this.normalizeScheduleUserIds(schedule.userId);

      return {
        /*
        {
          tenantId: "tenant1",
          createdBy: "manager1",
          managedBy: "manager1",
          userId: ["staffA", "staffB"],
          shiftTemplateId: "morningShift",
          workDate: "2026-07-01",
          startAt: "2026-07-01T08:00:00.000Z",
          endAt: "2026-07-01T12:00:00.000Z",
          status: "SCHEDULED"
        }
        */
        tenantId,
        createdBy,
        managedBy: createdBy,
        userId: scheduleUserIds,
        shiftTemplateId: schedule.shiftTemplateId,
        workDate,
        startAt,
        endAt,
        status: "SCHEDULED",
      };
    });

    const schedulesToSave = [];

    for (const schedule of schedules) {

      //check for already existing schedule with same shiftTemplateId, workDate, startAt, endAt and status not in ["CANCELLED", "DELETED"]
      const existingSchedule = await WorkingSchedule.findOne({
        tenantId,
        shiftTemplateId: schedule.shiftTemplateId,
        workDate: schedule.workDate,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        status: { $nin: ["CANCELLED", "DELETED"] },
      });

      await this.checkScheduleOverlaps(tenantId, [
        {
          ...schedule,
          scheduleIdToExclude: existingSchedule?._id,
        },
      ]);

      if (existingSchedule) {
        const updatedSchedule = await WorkingSchedule.findOneAndUpdate(
          { _id: existingSchedule._id, tenantId },
          {
            $addToSet: {
              userId: { $each: schedule.userId },
            },
            $set: {
              managedBy: createdBy,
            },
          },
          { new: true, runValidators: true },
        );

        schedulesToSave.push(updatedSchedule);
      } else {
        const createdSchedule = await WorkingSchedule.create(schedule);
        schedulesToSave.push(createdSchedule);
      }
    }

    return {
      message: "Phân ca thành công",
      data: schedulesToSave,
    };
  }

  // Lấy danh sách lịch làm việc, có filter theo nhân viên, ngày và trạng thái.
  async getWorkingScheduleList(
    tenantId,
    { page, recordPerPage, userId, startDate, endDate, status } = {},
  ) {
    if (!tenantId) {
      const error = new Error("Thiếu thông tin tenant");
      error.statusCode = 400;
      throw error;
    }

    const selectedFields =
      "userId shiftTemplateId workDate startAt endAt status managedBy";
    const populatedFields = [
      {
        path: "userId",
        select: "phoneNumber profile role",
      },
      {
        path: "shiftTemplateId",
      },
    ];

    const result = await this.fetchWorkingSchedules({
      tenantId,
      query: { userId, startDate, endDate, status },
      selectedFields,
      populatedFields,
      page,
      recordPerPage,
    });

    // Data mẫu trả về:
    // {
    //   data: [{ _id: "...", userId: {...}, shiftTemplateId: {...}, status: "SCHEDULED" }],
    //   pagination: { total: 20, page: 1, recordPerPage: 10, totalPages: 2 }
    // }
    return {
      data: result.workingSchedules,
      pagination: result.pagination,
    };
  }

  async getCurrentWorkingSchedule(tenantId, userId) {
    if (!tenantId) {
      const error = new Error("Thiếu thông tin tenant");
      error.statusCode = 400;
      throw error;
    }

    if (!userId) {
      const error = new Error("Thiếu thông tin nhân viên");
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();

    const schedule = await WorkingSchedule.findOne({
      tenantId,
      userId,
      status: "SCHEDULED",
      startAt: { $lte: now },
      endAt: { $gt: now },
    })
      .populate("userId", "phoneNumber profile role")
      .populate("shiftTemplateId")
      .select("-__v")
      .lean();

    if (!schedule) {
      return {
        data: null,
        message: "Không có ca làm việc hiện tại",
        serverTime: now,
      };
    }

    const [scheduleWithAttendance] = await this.attachAttendanceSummaries(
      tenantId,
      [schedule],
      true,
    );

    return {
      data: zscheduleWithAttendance,
      serverTime: now,
    };
  }

  // Lấy chi tiết một lịch làm việc trong tenant hiện tại.
  async getWorkingScheduleById(tenantId, scheduleId) {
    const selectedFields = "-__v";
    const populatedFields = [
      {
        path: "userId",
        select: "phoneNumber profile role",
      },
      {
        path: "shiftTemplateId",
      },
    ];

    const result = await this.fetchWorkingSchedules({
      tenantId,
      query: { _id: scheduleId },
      selectedFields,
      populatedFields,
      page: 1,
      recordPerPage: 1,
      detail: true,
    });

    const schedule = result.workingSchedules[0];

    if (!schedule) {
      const error = new Error("Không tìm thấy lịch làm việc");
      error.statusCode = 404;
      throw error;
    }

    // Data mẫu trả về:
    // {
    //   _id: "...",
    //   userId: { phoneNumber: "0901234567", profile: {...}, role: "STAFF" },
    //   shiftTemplateId: { name: "Ca hành chính", startTime: "08:00", endTime: "17:00" },
    //   status: "SCHEDULED"
    // }
    return schedule;
  }

  // Cập nhật lịch làm việc; nếu đổi ngày hoặc ShiftTemplate thì tính lại startAt/endAt.
  async updateWorkingSchedule(tenantId, scheduleId, data = {}, userRole) {
    const existingSchedule = await WorkingSchedule.findOne({
      _id: scheduleId,
      tenantId,
      status: { $ne: "DELETED" },
    });

    if (!existingSchedule) {
      const error = new Error("Không tìm thấy lịch làm việc");
      error.statusCode = 404;
      throw error;
    }

    if (existingSchedule.status === "COMPLETED") {
      const error = new Error("Không thể cập nhật lịch làm việc đã hoàn thành");
      error.statusCode = 400;
      throw error;
    }

    const updateData = {};

    if (data.userId !== undefined) {
      await this.validateTenantStaff(tenantId, [data.userId], userRole);
      updateData.userId = data.userId;
    }

    const shiftTemplateToUseId =
      data.shiftTemplateId !== undefined
        ? data.shiftTemplateId
        : existingSchedule.shiftTemplateId;

    const nextWorkDate =
      data.workDate !== undefined ? data.workDate : existingSchedule.workDate;

    if (data.shiftTemplateId !== undefined || data.workDate !== undefined) {
      const shiftTemplatesById = await this.getTenantShiftTemplates(tenantId, [
        shiftTemplateToUseId,
      ]);

      const shiftTemplateId = String(shiftTemplateToUseId);
      const shiftTemplate = shiftTemplatesById[shiftTemplateId];
      const workDate = this.buildWorkDate(nextWorkDate);
      const { startAt, endAt } = this.configWorkAndEndDate(
        nextWorkDate,
        shiftTemplate,
      );

      updateData.shiftTemplateId = shiftTemplateToUseId;
      updateData.workDate = workDate;
      updateData.startAt = startAt;
      updateData.endAt = endAt;
    }
    // Nếu có thay đổi userId hoặc startAt/endAt thì phải check trùng lịch.
    if (
      updateData.userId !== undefined ||
      updateData.startAt !== undefined ||
      updateData.endAt !== undefined
    ) {
      await this.checkScheduleOverlaps(
        tenantId,
        [
          {
            userId: updateData.userId || existingSchedule.userId,
            startAt: updateData.startAt || existingSchedule.startAt,
            endAt: updateData.endAt || existingSchedule.endAt,
          },
        ],
        scheduleId,
      );
    }

    if (data.status !== undefined) {
      const status = String(data.status).trim().toUpperCase();
      const allowedStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];

      if (!allowedStatuses.includes(status)) {
        const error = new Error("Trạng thái lịch làm việc không hợp lệ");
        error.statusCode = 400;
        throw error;
      }

      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      const error = new Error("Không có dữ liệu để cập nhật");
      error.statusCode = 400;
      throw error;
    }

    const updatedSchedule = await WorkingSchedule.findOneAndUpdate(
      { _id: scheduleId, tenantId, status: { $ne: "DELETED" } },
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .populate("userId", "phoneNumber profile role")
      .populate("shiftTemplateId");

    // {
    //   message: "Cập nhật lịch làm việc thành công",
    //   data: { _id: "...", userId: {...}, shiftTemplateId: {...}, status: "COMPLETED" }
    // }
    return {
      message: "Cập nhật lịch làm việc thành công",
      data: updatedSchedule,
    };
  }

  // Xóa một lịch làm việc khỏi tenant hiện tại.
  async deleteWorkingSchedule(tenantId, scheduleId) {
    const schedule = await WorkingSchedule.findOne({
      _id: scheduleId,
      tenantId,
      status: { $ne: "DELETED" },
    });

    if (!schedule) {
      const error = new Error("Không tìm thấy lịch làm việc");
      error.statusCode = 404;
      throw error;
    }
    if (schedule.status === "COMPLETED") {
      const error = new Error("Không thể xóa lịch làm việc đã hoàn thành");
      error.statusCode = 400;
      throw error;
    }

    await WorkingSchedule.findOneAndUpdate(
      {
        _id: scheduleId,
        tenantId: tenantId,
        status: { $ne: "DELETED" },
      },
      {
        status: "DELETED",
      },
      {
        new: true,
        runValidators: true,
      },
    );

    // {
    //   message: "Xóa lịch làm việc thành công",
    //   data: { id: "665aaa1234567890abcdef12" }
    // }
    return {
      message: "Xóa lịch làm việc thành công",
      data: {
        id: schedule._id,
      },
    };
  }
}

module.exports = new WorkingScheduleService();

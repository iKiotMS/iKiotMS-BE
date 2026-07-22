const { STAFF_ROLES } = require("../../../constants/role");
const Attendance = require("../../../models/Attendance");
const Holiday = require("../../../models/Holiday");
const PayrollSetting = require("../../../models/PayrollSetting");
const ShiftTemplate = require("../../../models/ShiftTemplate");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");
const NotificationService = require("../../../services/notificationService");
const {
  BulkWorkingScheduleDTO,
  SCHEDULE_TYPES,
} = require("../dto/WorkingScheduleDTO");
const {
  attachAttendancesToUsers,
  getAttendanceKey,
  getScheduleUsers,
  getUserIdText,
  pickScheduleUser,
} = require("./WorkingScheduleAttendanceMapper");
const {
  buildWorkDate,
  configWorkAndEndDate,
  getLocalDateText,
  getPagination,
} = require("./WorkingScheduleDateUtils");

class WorkingScheduleService {
  //===============================================================================================================================================================================
  //===================================================================    Helper Functions    ====================================================================================
  //===============================================================================================================================================================================

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

  isSunday(workDate) {
    return new Date(workDate).getUTCDay() === 0;
  }

  buildDayType(isSunday, holiday) {
    if (isSunday && holiday) return "SUNDAY_HOLIDAY";
    if (isSunday) return "SUNDAY";
    if (holiday) return "HOLIDAY";
    return "NORMAL";
  }

  async attachScheduleDayInfo(tenantId, schedules) {
    if (!schedules.length) {
      return schedules;
    }

    const workDates = schedules
      .map((schedule) => schedule.workDate)
      .filter(Boolean)
      .map((workDate) => buildWorkDate(workDate));

    if (!workDates.length) {
      return schedules;
    }

    const startWorkDate = new Date(
      Math.min(...workDates.map((workDate) => workDate.getTime())),
    );
    const endWorkDate = new Date(
      Math.max(...workDates.map((workDate) => workDate.getTime())),
    );

    const holidays = await Holiday.find({
      tenantId,
      isActive: true,
      date: {
        $gte: startWorkDate,
        $lte: endWorkDate,
      },
      branchId: null,
    }).lean();

    const holidayByDate = {};
    holidays.forEach((holiday) => {
      holidayByDate[getLocalDateText(holiday.date)] = holiday;
    });

    return schedules.map((schedule) => {
      const dateText = getLocalDateText(schedule.workDate);
      const holiday = holidayByDate[dateText] || null;
      const sunday = this.isSunday(schedule.workDate);

      return {
        ...schedule,
        dayInfo: {
          dayType: this.buildDayType(sunday, holiday),
          isSunday: sunday,
          isHoliday: Boolean(holiday),
          holidayName: holiday?.name || null,
          holidayType: holiday?.type || null,
        },
      };
    });
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
            `Lịch làm việc bị trùng ca mẫu cho nhân viên ${current.userId} vào ngày ${getLocalDateText(current.workDate)}`,
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

  async attachAttendanceSummaries(tenantId, schedules, detail = false) {
    const payrollSetting = await PayrollSetting.findOne({
      tenantId,
      status: "ACTIVE",
    })
      .select("lateGraceMinutes")
      .lean();
    const lateGraceMinutes = payrollSetting?.lateGraceMinutes ?? 15;

    if (!schedules.length) {
      return attachAttendancesToUsers(schedules, {}, detail, lateGraceMinutes);
    }

    const userIds = [
      ...new Set(
        schedules
          .flatMap((schedule) => getScheduleUsers(schedule))
          .map((user) => getUserIdText(user)),
      ),
    ];
    const scheduleIds = schedules
      .map((schedule) => schedule._id)
      .filter(Boolean)
      .map(String);

    if (!userIds.length || !scheduleIds.length) {
      return attachAttendancesToUsers(schedules, {}, detail, lateGraceMinutes);
    }

    const selectFields = detail
      ? "scheduleId userId workDate status actualCheckinAt actualCheckoutAt checkInLocation checkOutLocation workedMinutes overtimeMinute lateMinutes"
      : "scheduleId userId workDate status actualCheckinAt actualCheckoutAt";

    const attendances = await Attendance.find({
      tenantId,
      userId: { $in: userIds },
      scheduleId: { $in: scheduleIds },
    })
      .select(selectFields)
      .lean();

    const attendanceByScheduleAndUser = {};
    attendances.forEach((attendance) => {
      const key = getAttendanceKey(attendance.scheduleId, attendance.userId);
      attendanceByScheduleAndUser[key] = attendance;
    });

    return attachAttendancesToUsers(
      schedules,
      attendanceByScheduleAndUser,
      detail,
      lateGraceMinutes,
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
    const pagination = getPagination({ page, recordPerPage });

    if (query._id) filter._id = query._id;

    if (query.userId) filter.userId = query.userId;

    if (query.branchId || query.warehouseId) {
      const userFilter = {
        tenantId,
        status: { $ne: "DELETED" },
      };

      if (query.branchId) userFilter.branchId = query.branchId;
      if (query.warehouseId) userFilter.warehouseId = query.warehouseId;

      const users = await User.find(userFilter).select("_id").lean();
      const scopedUserIds = users.map((user) => user._id);

      filter.userId = query.userId
        ? {
            $in: scopedUserIds.filter((id) => {
              return String(id) === String(query.userId);
            }),
          }
        : { $in: scopedUserIds };
    }

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

    if (query.scheduleType) {
      const scheduleType = String(query.scheduleType).trim().toUpperCase();

      if (!SCHEDULE_TYPES.includes(scheduleType)) {
        const error = new Error("Loại lịch làm việc không hợp lệ");
        error.statusCode = 400;
        throw error;
      }

      filter.scheduleType = scheduleType;
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
        filter.workDate.$gte = buildWorkDate(query.startDate);
      }

      if (query.endDate) {
        let endDateExclusive = buildWorkDate(query.endDate);
        endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
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

    const schedulesWithAttendance = await this.attachAttendanceSummaries(
      tenantId,
      workingSchedules,
      detail,
    );
    const data = await this.attachScheduleDayInfo(
      tenantId,
      schedulesWithAttendance,
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
      const workDate = buildWorkDate(schedule.workDate);
      const { startAt, endAt } = configWorkAndEndDate(
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
          startAt: "2026-07-01T01:00:00.000Z",
          endAt: "2026-07-01T05:00:00.000Z",
          scheduleType: "NORMAL",
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
        scheduleType: schedule.scheduleType,
        status: "SCHEDULED",
      };
    });
    const schedulesByTimeSlot = new Map();

    for (const schedule of schedules) {
      const key = [
        schedule.scheduleType,
        schedule.shiftTemplateId,
        schedule.workDate.toISOString(),
        schedule.startAt.toISOString(),
        schedule.endAt.toISOString(),
      ].join("|");
      const existingSchedule = schedulesByTimeSlot.get(key);

      if (existingSchedule) {
        const existingUserIds = new Set(existingSchedule.userId.map(String));

        schedule.userId.forEach((userId) => {
          if (!existingUserIds.has(String(userId))) {
            existingSchedule.userId.push(userId);
            existingUserIds.add(String(userId));
          }
        });
      } else {
        schedulesByTimeSlot.set(key, schedule);
      }
    }
    const mergedSchedules = Array.from(schedulesByTimeSlot.values());

    const schedulesToSave = [];

    for (const schedule of mergedSchedules) {
      //check for already existing schedule with same scheduleType, shiftTemplateId, workDate, startAt, endAt and status not in ["CANCELLED", "DELETED"]
      const existingSchedule = await WorkingSchedule.findOne({
        tenantId,
        scheduleType: schedule.scheduleType,
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

    // Báo cho từng nhân viên được xếp ca. Gộp theo người: một lần phân ca có thể
    // tạo nhiều dòng lịch cho cùng một người, không ai muốn nhận 5 thông báo.
    try {
      const scheduledUserIds = [
        ...new Set(
          schedulesToSave.flatMap((schedule) =>
            (schedule.userId || []).map(String),
          ),
        ),
      ].filter((userId) => userId !== String(createdBy));

      await NotificationService.notify({
        tenantId,
        recipientIds: scheduledUserIds,
        type: "SCHEDULE_ASSIGNED",
        title: "Bạn có lịch làm việc mới",
        description:
          "Quản lý vừa xếp ca cho bạn. Xem lịch làm việc để biết chi tiết.",
        link: "staffs/schedule",
      });
    } catch (error) {
      console.error(
        "[WorkingScheduleService] Không gửi được thông báo phân ca:",
        error.message,
      );
    }

    return {
      message: "Phân ca thành công",
      data: schedulesToSave,
    };
  }

  // Lấy danh sách lịch làm việc, có filter theo nhân viên, ngày và trạng thái.
  async getWorkingScheduleList(
    tenantId,
    {
      page,
      recordPerPage,
      userId,
      branchId,
      warehouseId,
      startDate,
      endDate,
      status,
      scheduleType,
    } = {},
  ) {
    if (!tenantId) {
      const error = new Error("Thiếu thông tin tenant");
      error.statusCode = 400;
      throw error;
    }

    const selectedFields =
      "userId shiftTemplateId workDate startAt endAt scheduleType status managedBy";
    const populatedFields = [
      {
        path: "userId",
        select: "phoneNumber profile role branchId warehouseId",
      },
      {
        path: "shiftTemplateId",
      },
    ];

    const result = await this.fetchWorkingSchedules({
      tenantId,
      query: {
        userId,
        branchId,
        warehouseId,
        startDate,
        endDate,
        status,
        scheduleType,
      },
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
        serverTime: now.toISOString(),
      };
    }

    const [scheduleWithAttendance] = await this.attachAttendanceSummaries(
      tenantId,
      [schedule],
      true,
    );
    const [scheduleWithDayInfo] = await this.attachScheduleDayInfo(tenantId, [
      scheduleWithAttendance,
    ]);

    return {
      data: scheduleWithDayInfo,
      serverTime: now.toISOString(),
    };
  }

  async getMyWorkingSchedules(
    tenantId,
    userId,
    { page, recordPerPage, startDate, endDate, status, scheduleType } = {},
  ) {
    const result = await this.getWorkingScheduleList(tenantId, {
      page,
      recordPerPage,
      userId,
      startDate,
      endDate,
      status,
      scheduleType,
    });

    return {
      ...result,
      data: result.data.map((schedule) => {
        return {
          ...schedule,
          userId: pickScheduleUser(schedule, userId) || null,
        };
      }),
    };
  }

  async getBranchWorkingSchedules(
    tenantId,
    branchId,
    userId,
    { page, recordPerPage, startDate, endDate, status, scheduleType } = {},
  ) {
    if (!branchId) {
      const error = new Error("Thiếu thông tin chi nhánh");
      error.statusCode = 400;
      throw error;
    }

    const result = await this.getWorkingScheduleList(tenantId, {
      page,
      recordPerPage,
      branchId,
      startDate,
      endDate,
      status,
      scheduleType,
    });

    return {
      ...result,
      data: result.data.map((schedule) => ({
        ...schedule,
        userId: Array.isArray(schedule.userId)
          ? schedule.userId.filter(
              (item) => String(item?._id || item) !== String(userId),
            )
          : schedule.userId,
      })),
    };
  }

  async getWarehouseWorkingSchedules(
    tenantId,
    warehouseId,
    { page, recordPerPage, startDate, endDate, status, scheduleType } = {},
  ) {
    if (!warehouseId) {
      const error = new Error("Thiếu thông tin kho");
      error.statusCode = 400;
      throw error;
    }

    const data = await this.getWorkingScheduleList(tenantId, {
      page,
      recordPerPage,
      warehouseId,
      startDate,
      endDate,
      status,
      scheduleType,
    });

    return {
      ...result,
      data: result.data.map((schedule) => ({
        ...schedule,
        userId: Array.isArray(schedule.userId)
          ? schedule.userId.filter(
              (item) => String(item?._id || item) !== String(userId),
            )
          : schedule.userId,
      })),
    };
  }

  // Lấy chi tiết một lịch làm việc trong tenant hiện tại.
  async getWorkingScheduleById(tenantId, scheduleId) {
    const selectedFields = "-__v";
    const populatedFields = [
      {
        path: "userId",
        select: "phoneNumber profile role branchId warehouseId",
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

  async getWorkingScheduleUserDetail(tenantId, scheduleId, userId) {
    const selectedFields = "-__v";
    const populatedFields = [
      {
        path: "userId",
        select: "phoneNumber profile role branchId warehouseId",
      },
      {
        path: "shiftTemplateId",
      },
    ];

    const result = await this.fetchWorkingSchedules({
      tenantId,
      query: { _id: scheduleId, userId },
      selectedFields,
      populatedFields,
      page: 1,
      recordPerPage: 1,
      detail: true,
    });

    const schedule = result.workingSchedules[0];

    if (!schedule) {
      const error = new Error("Không tìm thấy lịch làm việc của nhân viên");
      error.statusCode = 404;
      throw error;
    }

    const user = pickScheduleUser(schedule, userId);

    if (!user) {
      const error = new Error("Nhân viên không thuộc lịch làm việc này");
      error.statusCode = 404;
      throw error;
    }

    const { userId: _users, ...scheduleData } = schedule;

    return {
      ...scheduleData,
      user,
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

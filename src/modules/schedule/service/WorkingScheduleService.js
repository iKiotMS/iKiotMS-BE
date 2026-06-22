const { STAFF_ROLES } = require("../../../constants/role");
const ShiftTemplate = require("../../../models/ShiftTemplate");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const { validateRoleHierarchy } = require("../../../utils/permissionChecker");
const { BulkWorkingScheduleDTO } = require("../dto/WorkingScheduleDTO");

class WorkingScheduleService {
  //==================================================================================
  //===========================    Helper Functions    ===============================
  //==================================================================================

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
    return new Date(`${dateText}T${timeText}`);
  }

  // Lưu ngày làm việc ở mốc 00:00 theo timezone Việt Nam.
  buildWorkDate(workDate) {
    const dateText = this.getLocalDateText(workDate);
    return new Date(`${dateText}T00:00:00`); //YYYY-MM-DDT00:00:00
  }

  // Kiểm tra tất cả userId được phân ca có thuộc tenant và là staff hợp lệ.
  async validateTenantStaff(tenantId, userIds, userRole) {
    const uniqueUserIds = [...new Set(userIds.map(String))];

    const users = await User.find({
      _id: { $in: uniqueUserIds },
      tenantId,
      role: { $in: STAFF_ROLES },
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

  async checkScheduleOverlaps(
    tenantIds,
    schedules,
    ScheduleIdToExclude = null,
  ) {
    for (let i = 0; i < schedules.length; i++) {
      const current = schedules[i];

      for (let j = i + 1; j < schedules.length; j++) {
        const next = schedules[j];

        const sameUser = String(current.userId) === String(next.userId);
        const isOverlapping =
          current.startAt < next.endAt && current.endAt > next.startAt;

        if (sameUser && isOverlapping) {
          const error = new Error(
            `Lịch làm việc bị trùng ca mẫu cho nhân viên ${current.userId} vào ngày ${this.getLocalDateText(current.workDate)}`,
          );
          error.statusCode = 400;
          throw error;
        }
      }

      for (const schedule of schedules) {
        const filter = {
          tenantId,
          userId: schedule.userId,
          status: { $ne: "CANCELLED" },
          startAt: { $lt: schedule.endAt },
          endAt: { $gt: schedule.startAt },
        };

        if (ScheduleIdToExclude) {
          filter._id = { $ne: ScheduleIdToExclude };
        }

        const existingSchedule = await WorkingSchedule.findOne(filter);

        if (existingSchedule) {
          const error = new Error(
            "Nhân viên đã có lịch làm việc bị trùng thời gian",
          );
          error.statusCode = 400;
          throw error;
        }
      }
    }
  }

  //==================================================================================
  //===========================    Main Services    ==================================
  //==================================================================================

  // Nhận danh sách phân ca từ FE, validate, tính startAt/endAt rồi insert nhiều record.
  async createBulkWorkingSchedules(tenantId, createdBy, data, userRole) {
    const dto = new BulkWorkingScheduleDTO(tenantId, createdBy, data);
    const validation = dto.validate();

    if (!validation.isValid) {
      const error = new Error(validation.errors.join("; "));
      error.statusCode = validation.statusCode;
      throw error;
    }

    const userIds = dto.schedules.map((schedule) => {
      return schedule.userId;
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
      const startAt = this.buildDateTime(
        schedule.workDate,
        shiftTemplate.startTime,
      );
      const endAt = this.buildDateTime(
        schedule.workDate,
        shiftTemplate.endTime,
      );

      return {
        tenantId,
        createdBy,
        userId: schedule.userId,
        shiftTemplateId: schedule.shiftTemplateId,
        workDate,
        startAt,
        endAt,
        status: "SCHEDULED",
      };
    });

    await this.checkScheduleOverlaps(tenantId, schedules);

    const createdSchedules = await WorkingSchedule.insertMany(schedules);

    // Data mẫu trả về:
    // {
    //   message: "Phân ca thành công",
    //   data: [
    //     {
    //       _id: "...",
    //       tenantId: "...",
    //       userId: "...",
    //       shiftTemplateId: "...",
    //       workDate: "2026-06-19T17:00:00.000Z",
    //       startAt: "2026-06-20T01:00:00.000Z",
    //       endAt: "2026-06-20T10:00:00.000Z",
    //       status: "SCHEDULED"
    //     }
    //   ]
    // }
    return {
      message: "Phân ca thành công",
      data: createdSchedules,
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

    const pagination = this.getPagination({ page, recordPerPage });
    const filter = { tenantId };

    if (userId) filter.userId = userId;
    if (status) filter.status = String(status).trim().toUpperCase();

    if (startDate || endDate) {
      filter.workDate = {};

      if (startDate && Number.isNaN(new Date(startDate).getTime())) {
        const error = new Error(
          "Ngày bắt đầu không hợp lệ, hãy nhập(YYYY-MM-DD)",
        );
        error.statusCode = 400;
        throw error;
      }

      if (endDate && Number.isNaN(new Date(endDate).getTime())) {
        const error = new Error(
          "Ngày kết thúc không hợp lệ, hãy nhập(YYYY-MM-DD)",
        );
        error.statusCode = 400;
        throw error;
      }

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        const error = new Error(
          "Ngày bắt đầu không được lớn hơn ngày kết thúc",
        );
        error.statusCode = 400;
        throw error;
      }

      if (startDate) {
        filter.workDate.$gte = this.buildWorkDate(startDate); //2026-06-20T00:00:00.000Z
      }

      if (endDate) {
        let endDateExclusive = this.buildWorkDate(endDate); // increment date by 1 day since creating 2026-06-20T23:59:00.000Z is annoying
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        filter.workDate.$lt = endDateExclusive;
      }
    }
    //2026-06-21T00:00:00.000Z
    const data = await WorkingSchedule.find(filter)
      .populate("userId", "phoneNumber profile role")
      .populate("shiftTemplateId")
      .sort({ workDate: 1, startAt: 1 })
      .skip(pagination.skip)
      .limit(pagination.recordPerPage);
    const total = await WorkingSchedule.countDocuments(filter);

    // Data mẫu trả về:
    // {
    //   data: [{ _id: "...", userId: {...}, shiftTemplateId: {...}, status: "SCHEDULED" }],
    //   pagination: { total: 20, page: 1, recordPerPage: 10, totalPages: 2 }
    // }
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

  // Lấy chi tiết một lịch làm việc trong tenant hiện tại.
  async getWorkingScheduleById(tenantId, scheduleId) {
    const schedule = await WorkingSchedule.findOne({
      _id: scheduleId,
      tenantId,
    })
      .populate("userId", "phoneNumber profile role")
      .populate("shiftTemplateId");

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
      const startAt = this.buildDateTime(nextWorkDate, shiftTemplate.startTime);
      const endAt = this.buildDateTime(nextWorkDate, shiftTemplate.endTime);

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
      { _id: scheduleId, tenantId },
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

    await WorkingSchedule.deleteOne({
      _id: scheduleId,
      tenantId,
    });

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

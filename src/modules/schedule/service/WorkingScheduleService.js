const { STAFF_ROLES } = require("../../../constants/role");
const ShiftTemplate = require("../../../models/ShiftTemplate");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const { BulkWorkingScheduleDTO } = require("../dto/WorkingScheduleDTO");

const VIETNAM_TIMEZONE_OFFSET = "+07:00";

class WorkingScheduleService {
  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  throwValidationError(validation) {
    if (validation.isValid) return;

    const error = new Error(validation.errors.join("; "));
    error.statusCode = validation.statusCode;
    throw error;
  }

  getLocalDateText(dateValue) {
    return String(dateValue).slice(0, 10);
  }

  buildDateTime(workDate, timeText) {
    const dateText = this.getLocalDateText(workDate);
    return new Date(`${dateText}T${timeText}:00${VIETNAM_TIMEZONE_OFFSET}`);
  }

  buildWorkDate(workDate) {
    const dateText = this.getLocalDateText(workDate);
    return new Date(`${dateText}T00:00:00${VIETNAM_TIMEZONE_OFFSET}`);
  }

  async validateTenantStaff(tenantId, userIds) {
    // const uniqueUserIds = [...new Set(userIds.map(String))];

    const users = await User.find({
      _id: { $in: userIds },
      tenantId,
      role: { $in: STAFF_ROLES },
    }).select("_id");

    if (users.length !== userIds.length) {
      this.throwValidationError({
        isValid: false,
        errors: ["Một hoặc nhiều nhân viên không hợp lệ"],
        statusCode: 400
      });
    }
  }

  async getTenantShiftTemplates(tenantId, shiftTemplateIds) {
  
  
  const shiftTemplates = await ShiftTemplate.find({
      _id: { $in: shiftTemplateIds },
      tenantId,
    });

    if (shiftTemplates.length !== shiftTemplateIds.length) {
      this.throwValidationError({
        isValid: false,
        errors: ["Một hoặc nhiều ca mẫu không hợp lệ"],
        statusCode: 400
      });
    }

    const shiftTemplateById = {};

    shiftTemplates.forEach((shiftTemplate) => {
      const shiftTemplateId = String(shiftTemplate._id);
      shiftTemplateById[shiftTemplateId] = shiftTemplate;
    });

    return shiftTemplateById;
  }

  async createBulkWorkingSchedules(tenantId, createdBy, data) {
    const dto = new BulkWorkingScheduleDTO(tenantId, createdBy, data);
    const validation = dto.validate();

    if (validation.isValid) {
      const error = new Error(validation.errors.join("; "));
      error.statusCode = validation.statusCode;
      throw error;
    }

    const userIds = dto.schedules.map((schedule) => {
      return schedule.userId;
    });

    await this.validateTenantStaff(tenantId, userIds);

    const shiftTemplateIds = dto.schedules.map((schedule) => {
      return schedule.shiftTemplateId;
    });

    const shiftTemplateById = await ShiftTemplate.find({
      _id: { $in: shiftTemplateIds },
      tenantId,
    });

    const schedules = dto.schedules.map((schedule) => {
      const shiftTemplateId = String(schedule.shiftTemplateId);
      const shiftTemplate = shiftTemplateById[shiftTemplateId];
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

    const createdSchedules = await WorkingSchedule.insertMany(schedules);

    return {
      message: "Phân ca thành công",
      data: createdSchedules,
    };
  }

  async getWorkingScheduleList(
    tenantId,
    { page, recordPerPage, userId, startDate, endDate, status } = {},
  ) {
    if (!tenantId) {
      this.throwError("Thiếu thông tin tenant", 400);
    }

    const pagination = this.getPagination({ page, recordPerPage });
    const filter = { tenantId };

    if (userId) filter.userId = userId;
    if (status) filter.status = String(status).trim().toUpperCase();

    if (startDate || endDate) {
      filter.workDate = {};
      if (startDate) filter.workDate.$gte = new Date(startDate);
      if (endDate) filter.workDate.$lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      WorkingSchedule.find(filter)
        .populate("userId", "phoneNumber profile role")
        .populate("shiftTemplateId")
        .sort({ workDate: 1, startAt: 1 })
        .skip(pagination.skip)
        .limit(pagination.recordPerPage),
      WorkingSchedule.countDocuments(filter),
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

  async getWorkingScheduleById(tenantId, scheduleId) {
    const schedule = await WorkingSchedule.findOne({
      _id: scheduleId,
      tenantId,
    })
      .populate("userId", "phoneNumber profile role")
      .populate("shiftTemplateId");

    if (!schedule) {
      this.throwError("Không tìm thấy lịch làm việc", 404);
    }

    return schedule;
  }

  async updateWorkingSchedule(tenantId, scheduleId, data = {}) {
    const existingSchedule = await WorkingSchedule.findOne({
      _id: scheduleId,
      tenantId,
    });

    if (!existingSchedule) {
      this.throwError("Không tìm thấy lịch làm việc", 404);
    }

    const updateData = {};

    if (data.userId !== undefined) {
      await this.validateTenantStaff(tenantId, [data.userId]);
      updateData.userId = data.userId;
    }

    const shiftTemplateToUseId =
      data.shiftTemplateId !== undefined
        ? data.shiftTemplateId
        : existingSchedule.shiftTemplateId;
    
    const nextWorkDate =
      data.workDate !== undefined ? data.workDate : existingSchedule.workDate;

    if (data.shiftTemplateId !== undefined || data.workDate !== undefined) {
      const shiftTemplateById = await this.getTenantShiftTemplates(tenantId, [
        shiftTemplateToUseId,
      ]);

      const shiftTemplateId = String(shiftTemplateToUseId);
      const shiftTemplate = shiftTemplateById[shiftTemplateId];
      const workDate = this.buildWorkDate(nextWorkDate);
      const startAt = this.buildDateTime(nextWorkDate, shiftTemplate.startTime);
      const endAt = this.buildDateTime(nextWorkDate, shiftTemplate.endTime);

      updateData.shiftTemplateId = shiftTemplateToUseId;
      updateData.workDate = workDate;
      updateData.startAt = startAt;
      updateData.endAt = endAt;
    }

    if (data.status !== undefined) {
      const status = String(data.status).trim().toUpperCase();
      const allowedStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];

      if (!allowedStatuses.includes(status)) {
        this.throwError("Trạng thái lịch làm việc không hợp lệ", 400);
      }

      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      this.throwError("Không có dữ liệu để cập nhật", 400);
    }

    const updatedSchedule = await WorkingSchedule.findOneAndUpdate(
      { _id: scheduleId, tenantId },
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .populate("userId", "phoneNumber profile role")
      .populate("shiftTemplateId");

    return {
      message: "Cập nhật lịch làm việc thành công",
      data: updatedSchedule,
    };
  }

  async deleteWorkingSchedule(tenantId, scheduleId) {
    const schedule = await WorkingSchedule.findOneAndDelete({
      _id: scheduleId,
      tenantId,
    });

    if (!schedule) {
      this.throwError("Không tìm thấy lịch làm việc", 404);
    }

    return {
      message: "Xóa lịch làm việc thành công",
      data: {
        id: schedule._id,
      },
    };
  }
}

module.exports = new WorkingScheduleService();

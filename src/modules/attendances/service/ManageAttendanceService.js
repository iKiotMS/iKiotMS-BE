const BaseService = require("../../../common/services/baseService");
const { Attendance, User } = require("../../../models");

class ManageAttendanceService extends BaseService {
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

  async getAttendanceById(tenantId, attendanceId, accessFilter = {}) {
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

    const attendanceFilter = await this.buildFilter({
      tenantId,
      ...accessFilter,
    });
    attendanceFilter._id = attendanceId;

    const attendance = await Attendance.findOne(attendanceFilter)
      .populate(detailPopulateFields)
      .select(detailFields)
      .lean();

    if (!attendance) {
      const error = new Error("Attendance not found");
      error.statusCode = 404;
      throw error;
    }

    return attendance;
  }
}

module.exports = { ManageAttendanceService };

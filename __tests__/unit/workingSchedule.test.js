jest.mock("../../src/models/User", () => ({
  find: jest.fn(),
}));

jest.mock("../../src/models/ShiftTemplate", () => ({
  find: jest.fn(),
}));

jest.mock("../../src/models/WorkingSchedule", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../../src/models/Attendance", () => ({
  find: jest.fn(),
  exists: jest.fn(),
}));

jest.mock("../../src/models/PayrollSetting", () => ({
  findOne: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({ lateGraceMinutes: 15 }),
  })),
}));

const User = require("../../src/models/User");
const ShiftTemplate = require("../../src/models/ShiftTemplate");
const WorkingSchedule = require("../../src/models/WorkingSchedule");
const Attendance = require("../../src/models/Attendance");
const WorkingScheduleService = require("../../src/modules/schedule/service/WorkingScheduleService");
const {
  attachAttendancesToUsers,
  getAttendanceKey,
  getLateMinutes,
} = require("../../src/modules/schedule/service/WorkingScheduleAttendanceMapper");

const sameDate = (left, right) => {
  return new Date(left).getTime() === new Date(right).getTime();
};

const makeLeanQuery = (value) => {
  const query = {
    populate: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value),
  };

  return query;
};

describe("WorkingScheduleService.createBulkWorkingSchedules", () => {
  let schedules;
  let nextId;

  beforeEach(() => {
    schedules = [];
    nextId = 1;
    jest.clearAllMocks();

    const users = [
      { _id: "staffA", role: "STAFF", status: "ACTIVE" },
      { _id: "staffB", role: "STAFF", status: "ACTIVE" },
    ];
    const shiftTemplates = [
      {
        _id: "morningShift",
        tenantId: "tenant1",
        startTime: "08:00",
        endTime: "12:00",
        status: "ACTIVE",
      },
      {
        _id: "overlapShift",
        tenantId: "tenant1",
        startTime: "10:00",
        endTime: "14:00",
        status: "ACTIVE",
      },
    ];

    User.find.mockImplementation((filter) => {
      const requestedUserIds = filter._id.$in.map(String);

      return {
        select: jest.fn().mockResolvedValue(
          users.filter((user) => {
            return (
              requestedUserIds.includes(String(user._id)) &&
              filter.role.$in.includes(user.role) &&
              user.status === filter.status
            );
          }),
        ),
      };
    });

    ShiftTemplate.find.mockImplementation((filter) => {
      const requestedShiftTemplateIds = filter._id.$in.map(String);

      return Promise.resolve(
        shiftTemplates.filter((shiftTemplate) => {
          return (
            requestedShiftTemplateIds.includes(String(shiftTemplate._id)) &&
            shiftTemplate.tenantId === filter.tenantId &&
            shiftTemplate.status === "ACTIVE"
          );
        }),
      );
    });

    WorkingSchedule.findOne.mockImplementation((filter) => {
      const isOverlapCheck = Object.prototype.hasOwnProperty.call(
        filter,
        "userId",
      );

      if (isOverlapCheck) {
        const foundOverlap = schedules.find((schedule) => {
          const isExcluded =
            filter._id?.$ne && String(schedule._id) === String(filter._id.$ne);

          return (
            !isExcluded &&
            schedule.tenantId === filter.tenantId &&
            schedule.status !== "CANCELLED" &&
            schedule.status !== "DELETED" &&
            schedule.userId.map(String).includes(String(filter.userId)) &&
            schedule.startAt < filter.startAt.$lt &&
            schedule.endAt > filter.endAt.$gt
          );
        });

        return makeLeanQuery(foundOverlap || null);
      }

      return Promise.resolve(
        schedules.find((schedule) => {
          return (
            schedule.tenantId === filter.tenantId &&
            schedule.scheduleType === filter.scheduleType &&
            schedule.shiftTemplateId === filter.shiftTemplateId &&
            sameDate(schedule.workDate, filter.workDate) &&
            sameDate(schedule.startAt, filter.startAt) &&
            sameDate(schedule.endAt, filter.endAt) &&
            !filter.status.$nin.includes(schedule.status)
          );
        }) || null,
      );
    });

    WorkingSchedule.findOneAndUpdate.mockImplementation((filter, update) => {
      const schedule = schedules.find((item) => {
        return item._id === filter._id && item.tenantId === filter.tenantId;
      });

      update.$addToSet.userId.$each.forEach((userId) => {
        if (!schedule.userId.map(String).includes(String(userId))) {
          schedule.userId.push(userId);
        }
      });
      schedule.managedBy = update.$set.managedBy;

      return Promise.resolve(schedule);
    });

    WorkingSchedule.create.mockImplementation((schedule) => {
      const createdSchedule = {
        _id: `schedule${nextId}`,
        ...schedule,
      };

      nextId += 1;
      schedules.push(createdSchedule);

      return Promise.resolve(createdSchedule);
    });
  });

  test("merges users into an existing schedule with the same shift/date/time", async () => {
    schedules.push({
      _id: "existingSchedule",
      tenantId: "tenant1",
      createdBy: "manager1",
      managedBy: "manager1",
      userId: ["staffA"],
      shiftTemplateId: "morningShift",
      scheduleType: "NORMAL",
      workDate: new Date("2026-07-01T00:00:00.000Z"),
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T05:00:00.000Z"),
      status: "SCHEDULED",
    });

    const result = await WorkingScheduleService.createBulkWorkingSchedules(
      "tenant1",
      "manager1",
      {
        schedules: [
          {
            userId: ["staffA", "staffB"],
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
        ],
      },
      "TENANT_OWNER",
    );

    expect(result.message).toBe("Phân ca thành công");
    expect(result.data).toHaveLength(1);
    expect(WorkingSchedule.create).not.toHaveBeenCalled();
    expect(WorkingSchedule.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "existingSchedule", tenantId: "tenant1" },
      {
        $addToSet: {
          userId: { $each: ["staffA", "staffB"] },
        },
        $set: {
          managedBy: "manager1",
        },
      },
      { new: true, runValidators: true },
    );
    expect(schedules).toHaveLength(1);
    expect(schedules[0].userId).toEqual(["staffA", "staffB"]);
  });

  test("creates a new schedule when no matching schedule exists", async () => {
    const result = await WorkingScheduleService.createBulkWorkingSchedules(
      "tenant1",
      "manager1",
      {
        schedules: [
          {
            userId: "staffA",
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
        ],
      },
      "TENANT_OWNER",
    );

    expect(result.message).toBe("Phân ca thành công");
    expect(result.data).toHaveLength(1);
    expect(WorkingSchedule.findOneAndUpdate).not.toHaveBeenCalled();
    expect(WorkingSchedule.create).toHaveBeenCalledWith({
      tenantId: "tenant1",
      createdBy: "manager1",
      managedBy: "manager1",
      userId: ["staffA"],
      shiftTemplateId: "morningShift",
      scheduleType: "NORMAL",
      workDate: new Date("2026-07-01T00:00:00.000Z"),
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T05:00:00.000Z"),
      status: "SCHEDULED",
    });
    expect(schedules).toHaveLength(1);
  });

  test("merges duplicate schedules from the same request before saving", async () => {
    const result = await WorkingScheduleService.createBulkWorkingSchedules(
      "tenant1",
      "manager1",
      {
        schedules: [
          {
            userId: "staffA",
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
          {
            userId: "staffB",
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
        ],
      },
      "TENANT_OWNER",
    );

    expect(result.message).toBe("Phân ca thành công");
    expect(result.data).toHaveLength(1);
    expect(WorkingSchedule.create).toHaveBeenCalledTimes(1);
    expect(WorkingSchedule.findOneAndUpdate).not.toHaveBeenCalled();
    expect(WorkingSchedule.create).toHaveBeenCalledWith({
      tenantId: "tenant1",
      createdBy: "manager1",
      managedBy: "manager1",
      userId: ["staffA", "staffB"],
      shiftTemplateId: "morningShift",
      scheduleType: "NORMAL",
      workDate: new Date("2026-07-01T00:00:00.000Z"),
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T05:00:00.000Z"),
      status: "SCHEDULED",
    });
  });

  test("does not merge normal and overtime schedules from the same request", async () => {
    const result = await WorkingScheduleService.createBulkWorkingSchedules(
      "tenant1",
      "manager1",
      {
        schedules: [
          {
            userId: "staffA",
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
            scheduleType: "NORMAL",
          },
          {
            userId: "staffB",
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
            scheduleType: "OVERTIME",
          },
        ],
      },
      "TENANT_OWNER",
    );

    expect(result.message).toBe("Phân ca thành công");
    expect(result.data).toHaveLength(2);
    expect(WorkingSchedule.create).toHaveBeenCalledTimes(2);
    expect(WorkingSchedule.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: ["staffA"],
        scheduleType: "NORMAL",
      }),
    );
    expect(WorkingSchedule.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: ["staffB"],
        scheduleType: "OVERTIME",
      }),
    );
  });

  test("rejects a schedule when the staff member already has an overlapping schedule", async () => {
    schedules.push({
      _id: "existingSchedule",
      tenantId: "tenant1",
      createdBy: "manager1",
      managedBy: "manager1",
      userId: ["staffA"],
      shiftTemplateId: "morningShift",
      scheduleType: "NORMAL",
      workDate: new Date("2026-07-01T00:00:00.000Z"),
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T05:00:00.000Z"),
      status: "SCHEDULED",
    });

    await expect(
      WorkingScheduleService.createBulkWorkingSchedules(
        "tenant1",
        "manager1",
        {
          schedules: [
            {
              userId: "staffA",
              shiftTemplateId: "overlapShift",
              workDate: "2026-07-01",
            },
          ],
        },
        "TENANT_OWNER",
      ),
    ).rejects.toMatchObject({
      message: "Nhân viên đã có lịch làm việc bị trùng thời gian",
      statusCode: 400,
    });

    expect(WorkingSchedule.findOneAndUpdate).not.toHaveBeenCalled();
    expect(WorkingSchedule.create).not.toHaveBeenCalled();
    expect(schedules).toHaveLength(1);
  });
});

describe("WorkingScheduleAttendanceMapper", () => {
  test("attaches each attendance only to its user and working schedule", () => {
    const user = { _id: "staffA", profile: { firstName: "A" } };
    const schedules = [
      {
        _id: "normalSchedule",
        userId: [user],
        workDate: new Date("2026-07-01T00:00:00.000Z"),
        startAt: new Date("2026-07-01T01:00:00.000Z"),
        endAt: new Date("2026-07-01T10:00:00.000Z"),
        scheduleType: "NORMAL",
      },
      {
        _id: "overtimeSchedule",
        userId: [user],
        workDate: new Date("2026-07-01T00:00:00.000Z"),
        startAt: new Date("2026-07-01T10:00:00.000Z"),
        endAt: new Date("2026-07-01T12:00:00.000Z"),
        scheduleType: "OVERTIME",
      },
    ];
    const normalAttendance = {
      _id: "normalAttendance",
      scheduleId: "normalSchedule",
      userId: "staffA",
      status: "CHECKED_OUT",
      actualCheckinAt: new Date("2026-07-01T01:00:00.000Z"),
      actualCheckoutAt: new Date("2026-07-01T10:00:00.000Z"),
      workedMinutes: 540,
    };
    const overtimeAttendance = {
      _id: "overtimeAttendance",
      scheduleId: "overtimeSchedule",
      userId: "staffA",
      status: "CHECKED_OUT",
      actualCheckinAt: new Date("2026-07-01T10:00:00.000Z"),
      actualCheckoutAt: new Date("2026-07-01T12:00:00.000Z"),
      workedMinutes: 120,
    };
    const attendanceByScheduleAndUser = {
      [getAttendanceKey(normalAttendance.scheduleId, normalAttendance.userId)]:
        normalAttendance,
      [getAttendanceKey(
        overtimeAttendance.scheduleId,
        overtimeAttendance.userId,
      )]: overtimeAttendance,
    };

    const result = attachAttendancesToUsers(
      schedules,
      attendanceByScheduleAndUser,
      true,
    );

    expect(result[0].userId[0].attendance).toMatchObject({
      _id: "normalAttendance",
      status: "CHECKED_OUT",
      workedMinutes: 540,
      workedMinutesInThisSchedule: 540,
    });
    expect(result[1].userId[0].attendance).toMatchObject({
      _id: "overtimeAttendance",
      status: "CHECKED_OUT",
      workedMinutes: 120,
      workedMinutesInThisSchedule: 120,
      lateMinutes: 0,
    });
  });

  test("does not attach an attendance from another schedule on the same day", () => {
    const user = { _id: "staffA" };
    const schedule = {
      _id: "afternoonSchedule",
      userId: [user],
      workDate: new Date("2026-07-01T00:00:00.000Z"),
      startAt: new Date("2026-07-01T06:00:00.000Z"),
      endAt: new Date("2026-07-01T10:00:00.000Z"),
      scheduleType: "NORMAL",
    };
    const morningAttendance = {
      _id: "morningAttendance",
      scheduleId: "morningSchedule",
      userId: "staffA",
      status: "CHECKED_OUT",
      actualCheckinAt: new Date("2026-07-01T06:00:00.000Z"),
      actualCheckoutAt: new Date("2026-07-01T10:00:00.000Z"),
    };

    const result = attachAttendancesToUsers(
      [schedule],
      {
        [getAttendanceKey(
          morningAttendance.scheduleId,
          morningAttendance.userId,
        )]: morningAttendance,
      },
      true,
    );

    expect(result[0].userId[0].attendance).toMatchObject({
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
    });
  });

  test("calculates late minutes with a 15 minute grace period", () => {
    const schedule = {
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T05:00:00.000Z"),
      scheduleType: "NORMAL",
    };

    expect(
      getLateMinutes(
        {
          actualCheckinAt: new Date("2026-07-01T01:15:00.000Z"),
          actualCheckoutAt: new Date("2026-07-01T05:00:00.000Z"),
        },
        schedule,
      ),
    ).toBe(0);

    expect(
      getLateMinutes(
        {
          actualCheckinAt: new Date("2026-07-01T01:16:00.000Z"),
          actualCheckoutAt: new Date("2026-07-01T05:00:00.000Z"),
        },
        schedule,
      ),
    ).toBe(16);

    // IGNORE_WITHIN_GRACE does not subtract the grace period after it is exceeded.
    expect(
      getLateMinutes(
        {
          actualCheckinAt: new Date("2026-07-01T01:20:00.000Z"),
          actualCheckoutAt: new Date("2026-07-01T05:00:00.000Z"),
        },
        schedule,
        15,
      ),
    ).toBe(20);
  });
});

describe("WorkingScheduleService date filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    WorkingSchedule.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    WorkingSchedule.countDocuments.mockResolvedValue(0);
    Attendance.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  test("uses UTC next day as exclusive end date for workDate filters", async () => {
    await WorkingScheduleService.getWorkingScheduleList("tenant1", {
      startDate: "2026-07-02",
      endDate: "2026-07-04",
    });

    expect(WorkingSchedule.find).toHaveBeenCalledWith({
      tenantId: "tenant1",
      status: { $ne: "DELETED" },
      workDate: {
        $gte: new Date("2026-07-02T00:00:00.000Z"),
        $lt: new Date("2026-07-05T00:00:00.000Z"),
      },
    });
  });

  test("adds scheduleType to working schedule filters", async () => {
    await WorkingScheduleService.getWorkingScheduleList("tenant1", {
      scheduleType: "overtime",
    });

    expect(WorkingSchedule.find).toHaveBeenCalledWith({
      tenantId: "tenant1",
      status: { $ne: "DELETED" },
      scheduleType: "OVERTIME",
    });
  });

  test("getBranchWorkingSchedules passes branchId and query filters correctly without type error", async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "staff1" }]),
      }),
    });

    const queryParams = Object.create(null);
    queryParams.scheduleType = "NORMAL";

    await WorkingScheduleService.getBranchWorkingSchedules(
      "tenant1",
      "branch1",
      queryParams,
    );

    expect(WorkingSchedule.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant1",
        status: { $ne: "DELETED" },
        scheduleType: "NORMAL",
        userId: { $in: ["staff1"] },
      }),
    );
  });

  test("getWarehouseWorkingSchedules passes warehouseId and query filters correctly without type error", async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "staff2" }]),
      }),
    });

    const queryParams = Object.create(null);
    queryParams.scheduleType = "OVERTIME";

    await WorkingScheduleService.getWarehouseWorkingSchedules(
      "tenant1",
      "warehouse1",
      queryParams,
    );

    expect(WorkingSchedule.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant1",
        status: { $ne: "DELETED" },
        scheduleType: "OVERTIME",
        userId: { $in: ["staff2"] },
      }),
    );
  });
});

describe("WorkingScheduleService attendance lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WorkingSchedule.findOne.mockResolvedValue({
      _id: "schedule1",
      status: "SCHEDULED",
    });
    Attendance.exists.mockResolvedValue(null);
    WorkingSchedule.findOneAndUpdate.mockResolvedValue({ _id: "schedule1" });
  });

  test("does not delete or replace a schedule after attendance exists", async () => {
    Attendance.exists.mockResolvedValue({ _id: "attendance1" });

    await expect(
      WorkingScheduleService.deleteWorkingSchedule("tenant1", "schedule1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(WorkingSchedule.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("removes only an assignee who has no attendance", async () => {
    WorkingSchedule.findOne.mockResolvedValue({
      _id: "schedule1",
      status: "SCHEDULED",
      userId: ["staff1", "staff2"],
    });

    await WorkingScheduleService.removeUserFromWorkingSchedule(
      "tenant1",
      "schedule1",
      "staff2",
    );

    expect(Attendance.exists).toHaveBeenCalledWith({
      tenantId: "tenant1",
      scheduleId: "schedule1",
      userId: "staff2",
    });
    expect(WorkingSchedule.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      { $pull: { userId: "staff2" } },
      expect.any(Object),
    );
  });

  test("does not remove an assignee who already has attendance", async () => {
    WorkingSchedule.findOne.mockResolvedValue({
      _id: "schedule1",
      status: "SCHEDULED",
      userId: ["staff1", "staff2"],
    });
    Attendance.exists.mockResolvedValue({ _id: "attendance1" });

    await expect(
      WorkingScheduleService.removeUserFromWorkingSchedule(
        "tenant1",
        "schedule1",
        "staff1",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(WorkingSchedule.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

jest.mock("../../src/models", () => ({
  Attendance: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../src/models/WorkingSchedule", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../src/modules/staff/service/StaffService", () => ({
  getStaffWorkplace: jest.fn(),
}));

const { Attendance } = require("../../src/models");
const WorkingSchedule = require("../../src/models/WorkingSchedule");
const StaffService = require("../../src/modules/staff/service/StaffService");
const {
  TakeAttendanceService,
} = require("../../src/modules/attendances/service/TakeAttendanceService");

describe("Attendance belongs to one working schedule", () => {
  const tenantId = "tenant1";
  const userId = "staff1";
  const checkInData = {
    scheduleId: "schedule1",
    actualCheckinAt: "2026-07-01T22:30:00.000Z",
    latitude: 10,
    longitude: 106,
    accuracy: 10,
  };
  const schedule = {
    _id: "schedule1",
    workDate: new Date("2026-07-02T00:00:00.000Z"),
    startAt: new Date("2026-07-01T23:00:00.000Z"),
    endAt: new Date("2026-07-02T03:00:00.000Z"),
    status: "SCHEDULED",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    WorkingSchedule.findOne.mockResolvedValue(schedule);
    Attendance.findOne.mockResolvedValue(null);
    Attendance.create.mockImplementation(async (data) => ({
      _id: "attendance1",
      ...data,
    }));
    StaffService.getStaffWorkplace.mockResolvedValue({
      workplace: {
        attendanceTakingLocation: {
          latitude: 10,
          longitude: 106,
          allowedRadiusMeters: 100,
          maxAccuracyMeters: 100,
        },
      },
    });
  });

  test("creates attendance with the selected schedule workDate", async () => {
    const service = new TakeAttendanceService();

    await service.checkIn(tenantId, userId, checkInData);

    expect(WorkingSchedule.findOne).toHaveBeenCalledWith({
      _id: "schedule1",
      tenantId,
      userId,
      status: "SCHEDULED",
    });
    expect(Attendance.findOne).toHaveBeenCalledWith({
      tenantId,
      userId,
      scheduleId: "schedule1",
    });
    expect(Attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        scheduleId: "schedule1",
        workDate: schedule.workDate,
        status: "CHECKED_IN",
      }),
    );
  });

  test("rejects check-in when scheduleId is missing", async () => {
    const service = new TakeAttendanceService();

    await expect(
      service.checkIn(tenantId, userId, {
        ...checkInData,
        scheduleId: undefined,
      }),
    ).rejects.toMatchObject({
      message: "Dữ liệu không hợp lệ",
      statusCode: 400,
      errors: expect.arrayContaining(["Thiếu thông tin ca làm việc"]),
    });
    expect(WorkingSchedule.findOne).not.toHaveBeenCalled();
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  test("rejects a second attendance for the same user and schedule", async () => {
    const service = new TakeAttendanceService();
    Attendance.findOne.mockResolvedValue({
      _id: "existingAttendance",
      userId,
      scheduleId: "schedule1",
      status: "CHECKED_OUT",
    });

    await expect(
      service.checkIn(tenantId, userId, checkInData),
    ).rejects.toMatchObject({
      message: "Nhân viên đã điểm danh cho ca làm việc này",
      statusCode: 409,
    });
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  test("checkout updates the attendance created for that schedule", async () => {
    const service = new TakeAttendanceService();
    const attendance = {
      _id: "attendance1",
      tenantId,
      userId,
      scheduleId: "schedule1",
      actualCheckinAt: new Date("2026-07-01T23:00:00.000Z"),
      status: "CHECKED_IN",
      save: jest.fn().mockResolvedValue(undefined),
    };
    Attendance.findOne.mockResolvedValue(attendance);

    await service.checkOut(tenantId, userId, {
      attendanceId: "attendance1",
      actualCheckoutAt: "2026-07-02T03:00:00.000Z",
      latitude: 10,
      longitude: 106,
      accuracy: 10,
    });

    expect(Attendance.findOne).toHaveBeenCalledWith({
      _id: "attendance1",
      tenantId,
      userId,
    });
    expect(attendance.scheduleId).toBe("schedule1");
    expect(attendance.status).toBe("CHECKED_OUT");
    expect(attendance.workedMinutes).toBe(240);
    expect(attendance.save).toHaveBeenCalledTimes(1);
  });
});

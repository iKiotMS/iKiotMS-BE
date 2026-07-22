jest.mock("../../src/models", () => ({
  Attendance: { create: jest.fn() },
  WorkingSchedule: { findOne: jest.fn() },
  User: { findOne: jest.fn() },
}));

const { Attendance, WorkingSchedule, User } = require("../../src/models");
const CreateManualAttendanceDTO = require("../../src/modules/attendances/dto/CreateManualAttendanceDTO");
const {
  ManageAttendanceService,
} = require("../../src/modules/attendances/service/ManageAttendanceService");

describe("Create manual attendance", () => {
  const tenantId = "507f1f77bcf86cd799439011";
  const manager = {
    userId: "manager1",
    role: "BRANCH_MANAGER",
    branchId: "branch1",
  };
  const schedule = {
    _id: "schedule1",
    workDate: new Date("2025-07-23T00:00:00.000Z"),
    startAt: new Date("2025-07-23T01:00:00.000Z"),
    endAt: new Date("2025-07-23T09:00:00.000Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    WorkingSchedule.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(schedule),
    });
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "staff1",
          branchId: "branch1",
        }),
      }),
    });
    Attendance.create.mockImplementation(async (data) => data);
  });

  test("creates a completed attendance with audit fields", async () => {
    const dto = new CreateManualAttendanceDTO({
      scheduleId: "schedule1",
      userId: "staff1",
      status: "CHECKED_OUT",
      actualCheckinAt: "2025-07-23T01:00:00.000Z",
      actualCheckoutAt: "2025-07-23T09:00:00.000Z",
      reason: "Thiết bị chấm công bị lỗi",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await service.createManualAttendance(tenantId, dto, manager);

    expect(Attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "schedule1",
        userId: "staff1",
        status: "CHECKED_OUT",
        workedMinutes: 480,
        manuallyCreatedBy: "manager1",
        manualCreationReason: "Thiết bị chấm công bị lỗi",
      }),
    );
  });

  test("marks absent only after the shift has ended", async () => {
    const dto = new CreateManualAttendanceDTO({
      scheduleId: "schedule1",
      userId: "staff1",
      status: "ABSENT",
      reason: "Không đi làm",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await service.createManualAttendance(tenantId, dto, manager);

    expect(Attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ABSENT", workedMinutes: 0 }),
    );
  });

  test("converts the unique-index error into a conflict", async () => {
    Attendance.create.mockRejectedValue({ code: 11000 });
    const dto = new CreateManualAttendanceDTO({
      scheduleId: "schedule1",
      userId: "staff1",
      status: "CHECKED_IN",
      actualCheckinAt: "2025-07-23T01:00:00.000Z",
      reason: "Máy nhân viên bị lỗi",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.createManualAttendance(tenantId, dto, manager),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

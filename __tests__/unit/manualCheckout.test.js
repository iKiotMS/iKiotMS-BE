jest.mock("../../src/models", () => ({
  Attendance: { findOne: jest.fn() },
  User: {},
}));

const { Attendance } = require("../../src/models");
const ManualCheckoutDTO = require("../../src/modules/attendances/dto/ManualCheckoutDTO");
const {
  ManageAttendanceService,
} = require("../../src/modules/attendances/service/ManageAttendanceService");

describe("Manual attendance checkout", () => {
  const tenantId = "507f1f77bcf86cd799439011";
  const manager = {
    userId: "manager1",
    role: "BRANCH_MANAGER",
    branchId: "branch1",
  };

  function mockAttendance(overrides = {}) {
    const attendance = {
      _id: "attendance1",
      userId: { _id: "staff1", branchId: "branch1" },
      status: "CHECKED_IN",
      actualCheckinAt: new Date("2025-07-23T01:00:00.000Z"),
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    Attendance.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(attendance),
    });
    return attendance;
  }

  beforeEach(() => jest.clearAllMocks());

  test("manager completes checkout and stores audit information", async () => {
    const attendance = mockAttendance();
    const dto = new ManualCheckoutDTO({
      actualCheckoutAt: "2025-07-23T09:30:00.000Z",
      reason: "Nhân viên quên check-out",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await service.manualCheckout(tenantId, "attendance1", dto, manager);

    expect(attendance.status).toBe("CHECKED_OUT");
    expect(attendance.workedMinutes).toBe(510);
    expect(attendance.manuallyEditedBy).toBe("manager1");
    expect(attendance.manualEditReason).toBe("Nhân viên quên check-out");
    expect(attendance.manuallyEditedAt).toBeInstanceOf(Date);
    expect(attendance.save).toHaveBeenCalledTimes(1);
  });

  test("does not allow a manager to edit their own attendance", async () => {
    mockAttendance({ userId: { _id: "manager1", branchId: "branch1" } });
    const dto = new ManualCheckoutDTO({
      actualCheckoutAt: "2025-07-23T09:30:00.000Z",
      reason: "Quên check-out",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.manualCheckout(tenantId, "attendance1", dto, manager),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("does not allow a warehouse manager to edit staff attendance", async () => {
    mockAttendance({ userId: { _id: "staff1", warehouseId: "warehouse1" } });
    const dto = new ManualCheckoutDTO({
      actualCheckoutAt: "2025-07-23T09:30:00.000Z",
      reason: "Quên check-out",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.manualCheckout(tenantId, "attendance1", dto, {
        userId: "warehouseManager1",
        role: "WAREHOUSE_MANAGER",
        warehouseId: "warehouse1",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("rejects checkout time before check-in", async () => {
    const attendance = mockAttendance();
    const dto = new ManualCheckoutDTO({
      actualCheckoutAt: "2025-07-23T00:30:00.000Z",
      reason: "Nhập bù",
    });
    const service = new ManageAttendanceService();
    service.validateTenantId = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.manualCheckout(tenantId, "attendance1", dto, manager),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(attendance.save).not.toHaveBeenCalled();
  });

  test("requires a reason", () => {
    const dto = new ManualCheckoutDTO({
      actualCheckoutAt: "2025-07-23T09:30:00.000Z",
      reason: " ",
    });

    expect(dto.validate()).toMatchObject({
      isValid: false,
      errors: { reason: "Lý do điều chỉnh là bắt buộc" },
    });
  });
});

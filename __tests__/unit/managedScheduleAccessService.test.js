jest.mock("../../src/models/WorkingSchedule", () => ({
  find: jest.fn(),
}));
jest.mock("../../src/models/User", () => ({
  findOne: jest.fn(),
}));

const WorkingSchedule = require("../../src/models/WorkingSchedule");
const User = require("../../src/models/User");
const ManagedScheduleAccessService = require("../../src/services/managedScheduleAccessService");
const permissions = require("../../src/config/permissions.json");

function mockSchedules(schedules) {
  const query = {
    select: jest.fn(),
    populate: jest.fn(),
    lean: jest.fn().mockResolvedValue(schedules),
  };
  query.select.mockReturnValue(query);
  query.populate.mockReturnValue(query);
  WorkingSchedule.find.mockReturnValue(query);
  return query;
}

function mockManagedStaff(data) {
  const query = {
    select: jest.fn(),
    lean: jest.fn().mockResolvedValue(data),
  };
  query.select.mockReturnValue(query);
  User.findOne.mockReturnValue(query);
  return query;
}

describe("Managed schedule access service", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");
  const user = {
    tenantId: "64a000000000000000000001",
    userId: "64a000000000000000000002",
    role: "STAFF",
  };

  beforeEach(() => jest.clearAllMocks());

  test("keeps managed permissions out of the permanent STAFF role", () => {
    expect(permissions.STAFF.suppliers).toBeUndefined();
    expect(permissions.STAFF.stock_movement).toBeUndefined();
    expect(permissions.STAFF.cash_drawers).toEqual(["read_own", "report"]);
  });

  test("does not grant supplier debt payment as a temporary permission", () => {
    expect(
      ManagedScheduleAccessService.supports("suppliers", "pay_debt"),
    ).toBe(false);
  });

  test("does not grant supplier creation as a temporary permission", () => {
    expect(
      ManagedScheduleAccessService.supports("suppliers", "create"),
    ).toBe(false);
  });

  test("resolves active managed schedules and their location scope", async () => {
    mockManagedStaff({
      branchId: "branch-1",
      warehouseId: "warehouse-1",
    });
    mockSchedules([
      {
        _id: "schedule-1",
        startAt: new Date("2026-07-15T01:00:00.000Z"),
        endAt: new Date("2026-07-15T05:00:00.000Z"),
        userId: [
          { branchId: "branch-1" },
          { branchId: "branch-outside-scope" },
          { warehouseId: "warehouse-1" },
        ],
      },
    ]);

    const access = await ManagedScheduleAccessService.resolve(
      user,
      "stock_movement",
      ["read"],
      now,
    );

    expect(WorkingSchedule.find).toHaveBeenCalledWith({
      tenantId: "64a000000000000000000001",
      managedBy: "64a000000000000000000002",
      status: "SCHEDULED",
      startAt: { $lte: now },
      endAt: { $gt: now },
    });
    expect(access).toMatchObject({
      temporary: true,
      scheduleIds: ["schedule-1"],
      branchIds: ["branch-1"],
      warehouseIds: ["warehouse-1"],
    });
    expect(access.branchIds).not.toContain("branch-outside-scope");
    expect(
      ManagedScheduleAccessService.canAccessLocation(
        access,
        "branch-1",
        "branch",
      ),
    ).toBe(true);
    expect(
      ManagedScheduleAccessService.canAccessLocation(
        access,
        "branch-2",
        "branch",
      ),
    ).toBe(false);
  });

  test("returns no access when no active managed schedule exists", async () => {
    mockSchedules([]);

    await expect(
      ManagedScheduleAccessService.resolve(user, "suppliers", "read", now),
    ).resolves.toBeNull();
  });

  test("does not grant cash drawer access from a warehouse-only schedule", async () => {
    mockManagedStaff({ warehouseId: "warehouse-1" });
    mockSchedules([
      {
        _id: "schedule-1",
        startAt: new Date("2026-07-15T01:00:00.000Z"),
        endAt: new Date("2026-07-15T05:00:00.000Z"),
        userId: [{ warehouseId: "warehouse-1" }],
      },
    ]);

    await expect(
      ManagedScheduleAccessService.resolve(
        user,
        "cash_drawers",
        "open",
        now,
      ),
    ).resolves.toBeNull();
  });

  test("does not query schedules for non-staff or unlisted modules", async () => {
    await expect(
      ManagedScheduleAccessService.resolve(
        { ...user, role: "BRANCH_MANAGER" },
        "suppliers",
        "read",
        now,
      ),
    ).resolves.toBeNull();
    await expect(
      ManagedScheduleAccessService.resolve(user, "payroll", "read", now),
    ).resolves.toBeNull();
    expect(WorkingSchedule.find).not.toHaveBeenCalled();
  });
});

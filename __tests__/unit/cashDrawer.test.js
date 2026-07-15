const CashDrawerSession = require("../../src/models/CashDrawerSession");
const CashDrawerService = require("../../src/modules/cash-drawer/service/CashDrawerService");
const OpenCashDrawerDTO = require("../../src/modules/cash-drawer/dto/OpenCashDrawerDTO");
const ShiftLogDTO = require("../../src/modules/cash-drawer/dto/ShiftLogDTO");
const FinalizeCashDrawerDTO = require("../../src/modules/cash-drawer/dto/FinalizeCashDrawerDTO");
const permissions = require("../../src/config/permissions.json");
const { specs } = require("../../src/config/setupSwagger");

describe("Cash drawer handover log", () => {
  afterEach(() => jest.restoreAllMocks());

  test("allows only one daily session and one open session per branch", () => {
    const indexes = CashDrawerSession.schema.indexes();
    expect(indexes).toContainEqual([
      { tenantId: 1, branchId: 1, businessDate: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexes).toContainEqual([
      { tenantId: 1, branchId: 1, status: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { status: "OPEN" },
      }),
    ]);
  });

  test("stores opening, shift handover, and manager final logs", () => {
    expect(CashDrawerSession.schema.path("openingAmount")).toBeDefined();
    expect(CashDrawerSession.schema.path("shiftLogs").schema.path("type")).toBeDefined();
    expect(CashDrawerSession.schema.path("shiftLogs").schema.path("amount")).toBeDefined();
    expect(CashDrawerSession.schema.path("shiftLogs").schema.path("nextStaffId")).toBeDefined();
    expect(CashDrawerSession.schema.path("finalLog.amount")).toBeDefined();
    expect(CashDrawerSession.schema.path("finalLog.managerId")).toBeDefined();
    expect(CashDrawerSession.schema.path("adjustments")).toBeUndefined();
  });

  test("uses the Vietnam business date", () => {
    expect(CashDrawerService.businessDate(new Date("2026-07-14T18:00:00.000Z"))).toBe(
      "2026-07-15",
    );
  });

  test("validates monetary inputs", () => {
    expect(
      new OpenCashDrawerDTO({
        branchId: "branch",
        staffId: "staff",
        openingAmount: -1,
      }).validate(),
    ).toMatchObject({ isValid: false, errors: { openingAmount: expect.any(String) } });
    expect(new ShiftLogDTO({ amount: 100_000 }).validate()).toEqual({
      isValid: true,
      errors: {},
    });
    expect(new ShiftLogDTO({ type: "START", amount: 100_000 }).validate()).toEqual({
      isValid: true,
      errors: {},
    });
    expect(
      new ShiftLogDTO({
        type: "START",
        amount: 100_000,
        nextStaffId: "staff",
      }).validate(),
    ).toMatchObject({ isValid: false, errors: { nextStaffId: expect.any(String) } });
    expect(new FinalizeCashDrawerDTO({ finalAmount: 200_000 }).validate()).toEqual({
      isValid: true,
      errors: {},
    });
  });

  test("requires the current staff final shift log before finalization", async () => {
    jest.spyOn(CashDrawerSession, "findOne").mockResolvedValue({
      currentStaffId: "507f1f77bcf86cd799439012",
      shiftLogs: [],
    });

    await expect(
      CashDrawerService.finalize({
        actor: {
          tenantId: "507f1f77bcf86cd799439011",
          userId: "507f1f77bcf86cd799439013",
          role: "TENANT_OWNER",
        },
        sessionId: "507f1f77bcf86cd799439014",
        dto: new FinalizeCashDrawerDTO({ finalAmount: 200_000 }),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("records a START report in the existing shiftLogs array", async () => {
    const tenantId = "507f1f77bcf86cd799439011";
    const staffId = "507f1f77bcf86cd799439012";
    const branchId = "507f1f77bcf86cd799439013";
    const sessionId = "507f1f77bcf86cd799439014";
    const updatedAt = new Date("2026-07-15T01:00:00.000Z");
    jest.spyOn(CashDrawerSession, "findOne").mockResolvedValue({
      _id: sessionId,
      branchId,
      currentStaffId: staffId,
      shiftLogs: [],
      updatedAt,
    });
    jest
      .spyOn(CashDrawerSession, "findOneAndUpdate")
      .mockResolvedValue({ _id: sessionId });

    await CashDrawerService.submitShiftLog({
      actor: { tenantId, userId: staffId, role: "STAFF", branchId },
      sessionId,
      dto: new ShiftLogDTO({ type: "START", amount: 500_000 }),
    });

    expect(CashDrawerSession.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ currentStaffId: staffId, updatedAt }),
      expect.objectContaining({
        $push: {
          shiftLogs: expect.objectContaining({
            type: "START",
            staffId,
            amount: 500_000,
          }),
        },
      }),
      { new: true, runValidators: true },
    );
  });

  test("requires a START report before an END report", async () => {
    const tenantId = "507f1f77bcf86cd799439011";
    const staffId = "507f1f77bcf86cd799439012";
    const branchId = "507f1f77bcf86cd799439013";
    const sessionId = "507f1f77bcf86cd799439014";
    jest.spyOn(CashDrawerSession, "findOne").mockResolvedValue({
      _id: sessionId,
      branchId,
      currentStaffId: staffId,
      shiftLogs: [],
    });

    await expect(
      CashDrawerService.submitShiftLog({
        actor: { tenantId, userId: staffId, role: "STAFF", branchId },
        sessionId,
        dto: new ShiftLogDTO({ amount: 500_000 }),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("grants only handover-log permissions", () => {
    expect(permissions.BRANCH_MANAGER.cash_drawers).toEqual([
      "open",
      "read",
      "report",
      "finalize",
    ]);
    expect(permissions.STAFF.cash_drawers).toEqual(["read_own", "report"]);
  });

  test("scopes temporary managed staff to scheduled branches", () => {
    const actor = {
      tenantId: "507f1f77bcf86cd799439011",
      userId: "507f1f77bcf86cd799439012",
      role: "STAFF",
      managedScheduleAccess: {
        temporary: true,
        branchIds: ["507f1f77bcf86cd799439013"],
        warehouseIds: [],
      },
    };

    expect(
      CashDrawerService.scopedBranchId(
        actor,
        "507f1f77bcf86cd799439013",
      ),
    ).toBe("507f1f77bcf86cd799439013");
    expect(() =>
      CashDrawerService.scopedBranchId(
        actor,
        "507f1f77bcf86cd799439014",
      ),
    ).toThrow("outside your managed schedule");
  });

  test("documents all routes and response schemas", () => {
    const paths = specs.paths;
    expect(paths["/cash-drawer-sessions"].post).toBeDefined();
    expect(paths["/cash-drawer-sessions"].get).toBeDefined();
    expect(paths["/cash-drawer-sessions/current"].get).toBeDefined();
    expect(paths["/cash-drawer-sessions/{id}"].get).toBeDefined();
    expect(paths["/cash-drawer-sessions/{id}/shift-logs"].post).toBeDefined();
    expect(paths["/cash-drawer-sessions/{id}/finalize"].post).toBeDefined();
    expect(
      paths["/cash-drawer-sessions/{id}/finalize"].post.responses["409"].$ref,
    ).toBe("#/components/responses/CashDrawerConflict");
    expect(specs.components.schemas.CashDrawerListResponse).toBeDefined();
  });
});

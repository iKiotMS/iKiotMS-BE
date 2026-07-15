const express = require("express");
const request = require("supertest");

jest.mock("../../src/services/managedScheduleAccessService", () => ({
  supports: jest.fn(),
  resolve: jest.fn(),
}));

const ManagedScheduleAccessService = require("../../src/services/managedScheduleAccessService");
const { authorize } = require("../../src/middlewares/authorizationMiddleware");

function createApp(moduleName, actions, tokenAccess) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = {
      tenantId: "tenant-1",
      userId: "staff-1",
      role: "STAFF",
      ...(tokenAccess && { managedScheduleAccess: tokenAccess }),
    };
    next();
  });
  app.get("/protected", authorize(moduleName, actions), (req, res) => {
    res.status(200).json({ access: req.user.managedScheduleAccess || null });
  });
  return app;
}

describe("Managed schedule authorization fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ManagedScheduleAccessService.supports.mockImplementation(
      (moduleName, action) =>
        ["cash_drawers", "suppliers", "stock_movement"].includes(
          moduleName,
        ) && ["create", "read", "open", "update"].includes(action),
    );
  });

  test("allows staff while an active managed schedule exists", async () => {
    ManagedScheduleAccessService.resolve.mockResolvedValue({
      temporary: true,
      scheduleIds: ["schedule-1"],
      branchIds: ["branch-1"],
      warehouseIds: [],
    });

    const response = await request(createApp("suppliers", "read")).get(
      "/protected",
    );

    expect(response.status).toBe(200);
    expect(response.body.access).toMatchObject({
      temporary: true,
      scheduleIds: ["schedule-1"],
    });
  });

  test("rejects staff before or after the managed schedule", async () => {
    ManagedScheduleAccessService.resolve.mockResolvedValue(null);

    const response = await request(createApp("stock_movement", "read")).get(
      "/protected",
    );

    expect(response.status).toBe(403);
  });

  test("can extend read_own into managed cash drawer read scope", async () => {
    ManagedScheduleAccessService.resolve.mockResolvedValue({
      temporary: true,
      scheduleIds: ["schedule-1"],
      branchIds: ["branch-1"],
      warehouseIds: [],
    });

    const response = await request(
      createApp("cash_drawers", ["read", "read_own"]),
    ).get("/protected");

    expect(response.status).toBe(200);
    expect(ManagedScheduleAccessService.resolve).toHaveBeenCalled();
  });

  test("does not trust a managed access context supplied by JWT claims", async () => {
    ManagedScheduleAccessService.resolve.mockResolvedValue(null);

    const response = await request(
      createApp("cash_drawers", ["read", "read_own"], {
        temporary: true,
        branchIds: ["forged-branch"],
      }),
    ).get("/protected");

    expect(response.status).toBe(200);
    expect(response.body.access).toBeNull();
  });

  test("returns a clean 500 response when schedule lookup fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    ManagedScheduleAccessService.resolve.mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await request(createApp("suppliers", "read")).get(
      "/protected",
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Failed to verify managed schedule access",
    });
    consoleSpy.mockRestore();
  });
});

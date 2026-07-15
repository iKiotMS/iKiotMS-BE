const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/modules/cash-drawer/service/CashDrawerService", () => ({
  open: jest.fn(),
  current: jest.fn(),
  list: jest.fn(),
  detail: jest.fn(),
  submitShiftLog: jest.fn(),
  finalize: jest.fn(),
}));

const CashDrawerService = require("../../src/modules/cash-drawer/service/CashDrawerService");
const { registerCashDrawerModule } = require("../../src/modules/cash-drawer");

describe("Cash drawer API", () => {
  const tenantId = "64a000000000000000000001";
  const branchId = "64a000000000000000000002";
  const managerId = "64a000000000000000000003";
  const staffId = "64a000000000000000000004";
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  const token = (role, userId) =>
    jwt.sign({ tenantId, branchId, role, userId }, secret, { expiresIn: "15m" });

  const app = express();
  app.use(express.json());
  registerCashDrawerModule(app);

  beforeEach(() => jest.clearAllMocks());

  test("rejects an unauthenticated open request", async () => {
    const response = await request(app).post("/cash-drawer-sessions").send({
      branchId,
      staffId,
      openingAmount: 500_000,
    });

    expect(response.status).toBe(401);
    expect(CashDrawerService.open).not.toHaveBeenCalled();
  });

  test("rejects staff attempting to open the drawer", async () => {
    const response = await request(app)
      .post("/cash-drawer-sessions")
      .set("Authorization", `Bearer ${token("STAFF", staffId)}`)
      .send({ branchId, staffId, openingAmount: 500_000 });

    expect(response.status).toBe(403);
    expect(CashDrawerService.open).not.toHaveBeenCalled();
  });

  test("validates openingAmount before calling the service", async () => {
    const response = await request(app)
      .post("/cash-drawer-sessions")
      .set("Authorization", `Bearer ${token("BRANCH_MANAGER", managerId)}`)
      .send({ branchId, staffId, openingAmount: -1 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: { openingAmount: expect.any(String) },
    });
    expect(CashDrawerService.open).not.toHaveBeenCalled();
  });

  test("opens the drawer for a branch manager", async () => {
    CashDrawerService.open.mockResolvedValue({
      _id: "64a000000000000000000005",
      openingAmount: 500_000,
      status: "OPEN",
    });
    const response = await request(app)
      .post("/cash-drawer-sessions")
      .set("Authorization", `Bearer ${token("BRANCH_MANAGER", managerId)}`)
      .send({ branchId, staffId, openingAmount: 500_000 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Cash drawer opened",
      data: { openingAmount: 500_000, status: "OPEN" },
    });
    expect(CashDrawerService.open).toHaveBeenCalledTimes(1);
  });

  test("allows staff to submit a shift log", async () => {
    CashDrawerService.submitShiftLog.mockResolvedValue({
      _id: "64a000000000000000000005",
      shiftLogs: [{ staffId, amount: 900_000 }],
    });
    const response = await request(app)
      .post("/cash-drawer-sessions/64a000000000000000000005/shift-logs")
      .set("Authorization", `Bearer ${token("STAFF", staffId)}`)
      .send({ amount: 900_000 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Shift log recorded",
    });
  });
});

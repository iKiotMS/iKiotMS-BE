const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/modules/holiday/service/HolidayService", () => ({
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  hardDelete: jest.fn(),
}));
jest.mock("../../src/utils/redisTest", () => {
  return jest.requireActual("express").Router();
});

const { createApp } = require("../../src/app");
const HolidayService = require("../../src/modules/holiday/service/HolidayService");

describe("Holiday management API", () => {
  const app = createApp();
  const tenantId = "64a000000000000000000001";
  const userId = "64a000000000000000000002";
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  const ownerToken = jwt.sign(
    { userId, tenantId, role: "TENANT_OWNER", phoneNumber: "0901000001" },
    secret,
    { expiresIn: "15m" },
  );
  const managerToken = jwt.sign(
    { userId, tenantId, role: "BRANCH_MANAGER", phoneNumber: "0901000002" },
    secret,
    { expiresIn: "15m" },
  );

  beforeEach(() => jest.clearAllMocks());

  test("tenant owner can disable a holiday", async () => {
    HolidayService.updateStatus.mockResolvedValue({
      _id: "64a000000000000000000003",
      isActive: false,
      isManuallyEdited: true,
    });
    const response = await request(app)
      .patch("/holidays/64a000000000000000000003/status")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      isActive: false,
      isManuallyEdited: true,
    });
  });

  test("branch manager cannot manage holidays", async () => {
    const response = await request(app)
      .delete("/holidays/64a000000000000000000003")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(403);
    expect(HolidayService.hardDelete).not.toHaveBeenCalled();
  });
});

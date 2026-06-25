const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { User, Tenant, Plan, Subscription, Branch } = require("../../src/models");
const jwt = require("jsonwebtoken");

let app;

describe("Branch API - Quota Checks", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.CONNECTION_STRING);
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await Branch.deleteMany({});
  });

  const createTestTenant = async (planCode = "TRIAL") => {
    const plan = await Plan.create({
      planName: planCode,
      planCode,
      price: 0,
      billingCycle: planCode === "TRIAL" ? "NONE" : "MONTHLY",
      trialDays: planCode === "TRIAL" ? 7 : 0,
      maxBranches: planCode === "TRIAL" ? 2 : planCode === "PLUS" ? 3 : -1,
      maxUsers: planCode === "TRIAL" ? 2 : planCode === "PLUS" ? 5 : -1,
      maxProducts: planCode === "TRIAL" ? 100 : planCode === "PLUS" ? 1000 : -1,
      features: [
        "stock_movement",
        "sales",
        "reports",
        "hr_management",
        "payroll",
      ],
      isActive: true,
    });

    const tenant = await Tenant.create({
      name: `Test Tenant ${Date.now()}`,
      status: "ACTIVE",
    });

    const owner = await User.create({
      tenantId: tenant._id,
      email: `owner${Date.now()}@test.com`,
      phoneNumber: `0901${Date.now().toString().slice(-7)}`,
      password: "Test@123",
      role: "TENANT_OWNER",
      status: "ACTIVE",
    });

    tenant.tenantOwnerId = owner._id;
    await tenant.save();

    const subscription = await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trialEndDate:
        planCode === "TRIAL"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : null,
      currentQuotaSnapshot: {
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        maxProducts: plan.maxProducts,
      },
    });

    return { tenant: tenant._id, owner, plan, subscription };
  };

  const generateToken = (user) => {
    return jwt.sign(
      {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        tenantId: user.tenantId,
      },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
  };

  test("Trial plan: Create branch ≤ 2 - should succeed", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/branches")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Chi nhánh 1",
        phoneNumber: ["0901234567"],
        address: "Hà Nội",
      });

    expect(response.status).toBe(201);
    expect(response.body.data._id).toBeDefined();
  });

  test("Trial plan: Create 3rd branch - should fail with quota error", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    // Create 2 branches
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post("/branches")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: `Chi nhánh ${i + 1}`,
          phoneNumber: [`090123456${i}`],
          address: "Hà Nội",
        });
    }

    // Try to create 3rd branch - should fail
    const response = await request(app)
      .post("/branches")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Chi nhánh 3",
        phoneNumber: ["0901234567"],
        address: "Hà Nội",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Branch limit reached");
  });

  test("Plus plan: Create branch ≤ 3 - should succeed", async () => {
    const { owner } = await createTestTenant("PLUS");
    const token = generateToken(owner);

    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .post("/branches")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: `Chi nhánh ${i + 1}`,
          phoneNumber: [`090123456${i}`],
          address: "Hà Nội",
        });

      expect(response.status).toBe(201);
    }
  });

  test("Pro plan: Create unlimited branches - should succeed", async () => {
    const { owner } = await createTestTenant("PRO");
    const token = generateToken(owner);

    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post("/branches")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: `Chi nhánh ${i + 1}`,
          phoneNumber: [`090123456${i}`],
          address: "Hà Nội",
        });

      expect(response.status).toBe(201);
    }
  });
});

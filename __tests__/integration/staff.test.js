const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../src/app");
const {
  User,
  Tenant,
  Plan,
  Subscription,
  RefreshToken,
} = require("../src/models");
const jwt = require("jsonwebtoken");

let app;

describe("Staff API - Quota Checks", () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.CONNECTION_STRING);
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  const createTestTenant = async (planCode = "TRIAL") => {
    // Create plan
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

    // Create tenant
    const tenant = await Tenant.create({
      name: `Test Tenant ${Date.now()}`,
      status: "ACTIVE",
    });

    // Create tenant owner
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

    // Create subscription
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

  test("Trial plan: Create staff ≤ 2 users - should succeed", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "staff1@test.com",
        phoneNumber: "0901234567",
        password: "Staff@123",
        role: "STAFF",
        status: "ACTIVE",
      });

    expect(response.status).toBe(201);
    expect(response.body._id).toBeDefined();
  });

  test("Trial plan: Create 3rd user - should fail with quota error", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    // Create 2 staff (limit is 2)
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post("/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: `staff${i}@test.com`,
          phoneNumber: `090123456${i}`,
          password: "Staff@123",
          role: "STAFF",
          status: "ACTIVE",
        });
    }

    // Try to create 3rd user - should fail
    const response = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "staff3@test.com",
        phoneNumber: "0901234567",
        password: "Staff@123",
        role: "STAFF",
        status: "ACTIVE",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("User limit reached");
  });

  test("Plus plan: Create staff ≤ 5 users - should succeed", async () => {
    const { owner } = await createTestTenant("PLUS");
    const token = generateToken(owner);

    // Create 5 staff
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post("/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: `staff${i}@test.com`,
          phoneNumber: `090123456${i}`,
          password: "Staff@123",
          role: "STAFF",
          status: "ACTIVE",
        });

      expect(response.status).toBe(201);
    }
  });

  test("Pro plan: Create unlimited staff - should succeed", async () => {
    const { owner } = await createTestTenant("PRO");
    const token = generateToken(owner);

    // Create 10 staff (well beyond any typical limit)
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post("/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: `staff${i}@test.com`,
          phoneNumber: `090123456${i}`,
          password: "Staff@123",
          role: "STAFF",
          status: "ACTIVE",
        });

      expect(response.status).toBe(201);
    }
  });

  test("No active subscription - should reject", async () => {
    // Create tenant without subscription
    const tenant = await Tenant.create({
      name: `Test Tenant ${Date.now()}`,
      status: "ACTIVE",
    });

    const user = await User.create({
      tenantId: tenant._id,
      email: `user${Date.now()}@test.com`,
      phoneNumber: `0901${Date.now().toString().slice(-7)}`,
      password: "Test@123",
      role: "TENANT_OWNER",
      status: "ACTIVE",
    });

    const token = generateToken(user);

    const response = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "staff@test.com",
        phoneNumber: "0901234567",
        password: "Staff@123",
        role: "STAFF",
        status: "ACTIVE",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("No active subscription");
  });

  test("Expired subscription - should reject", async () => {
    const { owner, tenant } = await createTestTenant("TRIAL");

    // Update subscription to EXPIRED
    await Subscription.updateOne({ tenantId: tenant }, { status: "EXPIRED" });

    const token = generateToken(owner);

    const response = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "staff@test.com",
        phoneNumber: "0901234567",
        password: "Staff@123",
        role: "STAFF",
        status: "ACTIVE",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("EXPIRED");
  });
});

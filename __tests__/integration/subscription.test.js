const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../src/app");
const { User, Tenant, Plan, Subscription } = require("../src/models");
const jwt = require("jsonwebtoken");

let app;

describe("Subscription API - Plan Upgrade", () => {
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
  });

  const createPlans = async () => {
    const plans = {
      TRIAL: await Plan.create({
        planName: "Trial",
        planCode: "TRIAL",
        price: 0,
        billingCycle: "NONE",
        trialDays: 7,
        maxBranches: 2,
        maxUsers: 2,
        maxProducts: 100,
        features: [
          "stock_movement",
          "sales",
          "reports",
          "hr_management",
          "payroll",
        ],
        isActive: true,
      }),
      PLUS: await Plan.create({
        planName: "Plus",
        planCode: "PLUS",
        price: 99999,
        billingCycle: "MONTHLY",
        trialDays: 0,
        maxBranches: 3,
        maxUsers: 5,
        maxProducts: 1000,
        features: [
          "stock_movement",
          "sales",
          "reports",
          "hr_management",
          "payroll",
        ],
        isActive: true,
      }),
      PRO: await Plan.create({
        planName: "Pro",
        planCode: "PRO",
        price: 299999,
        billingCycle: "MONTHLY",
        trialDays: 0,
        maxBranches: -1,
        maxUsers: -1,
        maxProducts: -1,
        features: [
          "stock_movement",
          "sales",
          "reports",
          "hr_management",
          "payroll",
        ],
        isActive: true,
      }),
    };
    return plans;
  };

  const createTestTenant = async (planCode = "TRIAL") => {
    const plans = await createPlans();

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
      planId: plans[planCode]._id,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trialEndDate:
        planCode === "TRIAL"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : null,
      currentQuotaSnapshot: {
        maxBranches: plans[planCode].maxBranches,
        maxUsers: plans[planCode].maxUsers,
        maxProducts: plans[planCode].maxProducts,
      },
    });

    return { tenant: tenant._id, owner, subscription, plans };
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

  test("Upgrade from TRIAL to PLUS - should succeed", async () => {
    const { owner, subscription } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    // Verify initial quota
    expect(subscription.currentQuotaSnapshot.maxUsers).toBe(2);

    const response = await request(app)
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "PLUS" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.newPlan.planCode).toBe("PLUS");
    expect(response.body.data.subscription.currentQuotaSnapshot.maxUsers).toBe(
      5,
    );
    expect(
      response.body.data.subscription.currentQuotaSnapshot.maxBranches,
    ).toBe(3);
  });

  test("Upgrade from PLUS to PRO - should succeed and unlock unlimited", async () => {
    const { owner } = await createTestTenant("PLUS");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "PRO" });

    expect(response.status).toBe(200);
    expect(response.body.data.newPlan.planCode).toBe("PRO");
    expect(response.body.data.subscription.currentQuotaSnapshot.maxUsers).toBe(
      -1,
    ); // unlimited
    expect(
      response.body.data.subscription.currentQuotaSnapshot.maxBranches,
    ).toBe(-1);
  });

  test("Downgrade from PLUS to TRIAL - should succeed", async () => {
    const { owner } = await createTestTenant("PLUS");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "TRIAL" });

    expect(response.status).toBe(200);
    expect(response.body.data.newPlan.planCode).toBe("TRIAL");
    expect(response.body.data.subscription.currentQuotaSnapshot.maxUsers).toBe(
      2,
    );
    expect(
      response.body.data.subscription.currentQuotaSnapshot.maxBranches,
    ).toBe(2);
  });

  test("Upgrade logs history event", async () => {
    const { owner, subscription: oldSubscription } =
      await createTestTenant("TRIAL");
    const token = generateToken(owner);

    // Count history logs before upgrade
    const beforeCount = oldSubscription.historyLogs.length;

    await request(app)
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "PLUS" });

    // Get updated subscription
    const updatedSubscription = await Subscription.findOne({
      tenantId: owner.tenantId,
    });

    // Verify new history log entry
    expect(updatedSubscription.historyLogs.length).toBeGreaterThan(beforeCount);
    const lastLog =
      updatedSubscription.historyLogs[
        updatedSubscription.historyLogs.length - 1
      ];
    expect(lastLog.event).toBe("UPGRADED");
    expect(lastLog.note).toContain("TRIAL");
    expect(lastLog.note).toContain("PLUS");
  });

  test("Upgrade without planCode - should fail", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("planCode is required");
  });

  test("Upgrade to invalid plan - should fail", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "INVALID" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Plan INVALID not found");
  });

  test("No subscription - upgrade should fail", async () => {
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
      .post("/subscription/upgrade")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "PLUS" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("No active subscription");
  });
});

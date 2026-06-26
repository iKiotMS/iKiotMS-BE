const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { User, Tenant, Plan, Subscription, Product, Branch } = require("../../src/models");
const jwt = require("jsonwebtoken");

let app;

describe("Product API - Quota Checks", () => {
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
    await Product.deleteMany({});
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

  const createProductPayload = (index = 0) => ({
    name: `Product ${index}`,
    status: "ACTIVE",
    items: [
      {
        productCode: `P${index}`,
        sku: `SKU${Date.now()}${index}`,
        retailPrice: 100000,
        costPrice: 50000,
        barcode: `BAR${Date.now()}${index}`,
      },
    ],
  });

  test("Trial plan: Create product ≤ 100 - should succeed", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${token}`)
      .send(createProductPayload(0));

    expect(response.status).toBe(201);
    expect(response.body.data._id).toBeDefined();
  });

  test("Trial plan: Create 101st product - should fail with quota error", async () => {
    const { owner } = await createTestTenant("TRIAL");
    const token = generateToken(owner);

    // Create 100 products (limit is 100)
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${token}`)
        .send(createProductPayload(i));
    }

    // Try to create 101st product - should fail
    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${token}`)
      .send(createProductPayload(100));

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Product limit reached");
  });

  test("Plus plan: Create product ≤ 1000 - should succeed", async () => {
    const { owner } = await createTestTenant("PLUS");
    const token = generateToken(owner);

    // Create 5 products to verify limit is higher
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${token}`)
        .send(createProductPayload(i));

      expect(response.status).toBe(201);
    }
  });

  test("Pro plan: Create unlimited products - should succeed", async () => {
    const { owner } = await createTestTenant("PRO");
    const token = generateToken(owner);

    // Create 10 products (well beyond any typical limit)
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${token}`)
        .send(createProductPayload(i));

      expect(response.status).toBe(201);
    }
  });

  test("Without subscription - should reject", async () => {
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
      .post("/products")
      .set("Authorization", `Bearer ${token}`)
      .send(createProductPayload(0));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("No active subscription");
  });
});

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createApp } = require("../../src/app");
const {
  User,
  Tenant,
  Branch,
  Product,
  ProductItem,
  Promotion,
} = require("../../src/models");

let app;

describe("Promotion checkout flow (candidates -> calculate)", () => {
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
    await Branch.deleteMany({});
    await Product.deleteMany({});
    await ProductItem.deleteMany({});
    await Promotion.deleteMany({});
  });

  const generateToken = (user) => {
    return jwt.sign(
      { userId: user._id, phoneNumber: user.phoneNumber, role: user.role, tenantId: user.tenantId, branchId: user.branchId },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
  };

  const setupTenantStaffAndCart = async () => {
    const tenant = await Tenant.create({ name: `Tenant ${Date.now()}`, status: "ACTIVE" });
    const branch = await Branch.create({
      tenantId: tenant._id,
      name: "Chi nhánh 1",
      status: "ACTIVE",
      phoneNumber: [`0901${Date.now().toString().slice(-7)}`],
    });
    const staff = await User.create({
      tenantId: tenant._id,
      phoneNumber: `0901${Date.now().toString().slice(-7)}`,
      password: "Test@123",
      role: "STAFF",
      branchId: branch._id,
      status: "ACTIVE",
    });
    const product = await Product.create({
      tenantId: tenant._id,
      name: "Sản phẩm test",
      status: "ACTIVE",
    });
    const productItem = await ProductItem.create({
      tenantId: tenant._id,
      productId: product._id,
      productName: "Sản phẩm test",
      productCode: "P1",
      sku: `SKU-${Date.now()}`,
      retailPrice: 1000000,
      costPrice: 500000,
    });
    return { tenant, branch, staff, product, productItem };
  };

  test("a tenant-wide FIXED_AMOUNT promotion appears as an eligible candidate and applies via calculate", async () => {
    const { tenant, branch, staff, productItem } = await setupTenantStaffAndCart();
    const token = generateToken(staff);

    await Promotion.create({
      tenantId: tenant._id,
      branchIds: [],
      promoName: "Giảm 200k",
      discountType: "FIXED_AMOUNT",
      discountValue: 200000,
      minOrderValue: 1000000,
      applicableRule: { type: "all" },
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    });

    const cartItems = [{ productItemId: productItem._id.toString(), quantity: 1, unitPrice: 1000000 }];

    const candidatesRes = await request(app)
      .post("/promotions/candidates")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch._id.toString(), items: cartItems });

    expect(candidatesRes.status).toBe(200);
    expect(candidatesRes.body.data.systemPromotions).toHaveLength(1);
    const candidate = candidatesRes.body.data.systemPromotions[0];
    expect(candidate.eligible).toBe(true);
    expect(candidate.previewDiscount).toBe(200000);

    const calculateRes = await request(app)
      .post("/promotions/calculate")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch._id.toString(), items: cartItems, promotionIds: [candidate.id] });

    expect(calculateRes.status).toBe(200);
    expect(calculateRes.body.data.totalDiscount).toBe(200000);
    expect(calculateRes.body.data.appliedPromotions).toHaveLength(1);
  });

  test("a branch-scoped promotion appears under branchPromotions, not systemPromotions", async () => {
    const { tenant, branch, staff, productItem } = await setupTenantStaffAndCart();
    const token = generateToken(staff);

    await Promotion.create({
      tenantId: tenant._id,
      branchIds: [branch._id],
      promoName: "Giảm chi nhánh",
      discountType: "PERCENT",
      discountValue: 10,
      applicableRule: { type: "all" },
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    });

    const cartItems = [{ productItemId: productItem._id.toString(), quantity: 1, unitPrice: 1000000 }];

    const candidatesRes = await request(app)
      .post("/promotions/candidates")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch._id.toString(), items: cartItems });

    expect(candidatesRes.status).toBe(200);
    expect(candidatesRes.body.data.branchPromotions).toHaveLength(1);
    expect(candidatesRes.body.data.systemPromotions).toHaveLength(0);
    expect(candidatesRes.body.data.branchPromotions[0].eligible).toBe(true);
  });

  test("an ineligible promotion (below minOrderValue) is listed but disabled with a reason, and calculate rejects selecting it", async () => {
    const { tenant, branch, staff, productItem } = await setupTenantStaffAndCart();
    const token = generateToken(staff);

    const promo = await Promotion.create({
      tenantId: tenant._id,
      branchIds: [],
      promoName: "Giảm đơn lớn",
      discountType: "FIXED_AMOUNT",
      discountValue: 200000,
      minOrderValue: 5000000,
      applicableRule: { type: "all" },
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    });

    const cartItems = [{ productItemId: productItem._id.toString(), quantity: 1, unitPrice: 1000000 }];

    const candidatesRes = await request(app)
      .post("/promotions/candidates")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch._id.toString(), items: cartItems });

    expect(candidatesRes.status).toBe(200);
    const candidate = candidatesRes.body.data.systemPromotions[0];
    expect(candidate.eligible).toBe(false);
    expect(candidate.reason).toBeTruthy();

    const calculateRes = await request(app)
      .post("/promotions/calculate")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch._id.toString(), items: cartItems, promotionIds: [promo._id.toString()] });

    expect(calculateRes.status).toBe(400);
  });
});

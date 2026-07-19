jest.mock("../../src/models", () => {
  const PromotionCtor = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  PromotionCtor.findOne = jest.fn();
  PromotionCtor.findOneAndUpdate = jest.fn();
  return {
    Promotion: PromotionCtor,
    PromotionLog: { aggregate: jest.fn() },
    ProductItem: { find: jest.fn() },
    Product: { find: jest.fn() },
    Branch: { find: jest.fn() },
    Order: { find: jest.fn() },
  };
});

const { Promotion, Branch } = require("../../src/models");
const PromotionService = require("../../src/modules/promotion/service/PromotionService");

function mockBranchFind(branches) {
  const query = { select: jest.fn(), lean: jest.fn() };
  query.select.mockReturnValue(query);
  query.lean.mockResolvedValue(branches);
  Branch.find.mockReturnValue(query);
}

function mockPromotionFindOne(doc) {
  const query = { lean: jest.fn().mockResolvedValue(doc) };
  Promotion.findOne.mockReturnValue(query);
}

describe("PromotionService branch-manager scope guard", () => {
  beforeEach(() => jest.clearAllMocks());

  test("createPromotion forces branchIds to the manager's own branch, ignoring a submitted tenant-wide/other-branch value", async () => {
    mockBranchFind([{ _id: "branchA" }]);
    const user = { role: "BRANCH_MANAGER", branchId: "branchA" };
    const data = {
      branchIds: [], // submitted as tenant-wide
      promoName: "Test",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
    };

    await PromotionService.createPromotion("tenant1", data, user);

    expect(data.branchIds).toEqual(["branchA"]);
  });

  test("createPromotion leaves branchIds unchanged for TENANT_OWNER", async () => {
    mockBranchFind([{ _id: "branchB" }]);
    const user = { role: "TENANT_OWNER", branchId: null };
    const data = {
      branchIds: ["branchB"],
      promoName: "Test",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
    };

    await PromotionService.createPromotion("tenant1", data, user);

    expect(data.branchIds).toEqual(["branchB"]);
  });

  test("updatePromotion rejects a BRANCH_MANAGER editing a promotion outside their own branch", async () => {
    mockPromotionFindOne({
      _id: "promo1",
      branchIds: ["branchOther"],
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
    });
    const user = { role: "BRANCH_MANAGER", branchId: "branchA" };

    await expect(
      PromotionService.updatePromotion("tenant1", "promo1", { promoName: "Hack" }, user),
    ).rejects.toThrow();
  });

  test("updatePromotion forces a BRANCH_MANAGER's submitted branchIds back to their own branch", async () => {
    mockPromotionFindOne({
      _id: "promo1",
      branchIds: ["branchA"],
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
    });
    mockBranchFind([{ _id: "branchA" }]);
    Promotion.findOneAndUpdate.mockResolvedValue({ _id: "promo1", branchIds: ["branchA"] });
    const user = { role: "BRANCH_MANAGER", branchId: "branchA" };
    const updateData = { branchIds: [] }; // attempting tenant-wide

    await PromotionService.updatePromotion("tenant1", "promo1", updateData, user);

    expect(updateData.branchIds).toEqual(["branchA"]);
  });

  test("updatePromotion does not scope-restrict a TENANT_OWNER", async () => {
    mockPromotionFindOne({
      _id: "promo1",
      branchIds: ["branchA"],
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-02-01"),
    });
    mockBranchFind([{ _id: "branchB" }]);
    Promotion.findOneAndUpdate.mockResolvedValue({ _id: "promo1", branchIds: ["branchB"] });
    const user = { role: "TENANT_OWNER", branchId: null };
    const updateData = { branchIds: ["branchB"] };

    await PromotionService.updatePromotion("tenant1", "promo1", updateData, user);

    expect(updateData.branchIds).toEqual(["branchB"]);
  });
});

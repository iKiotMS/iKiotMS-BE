const {
  evaluateEligibility,
  buildCandidateList,
  resolveSelectedPromotions,
} = require("../../src/modules/promotion/service/PricingEngine");

const NOW = new Date("2026-06-15T00:00:00.000Z");

function makePromotion(overrides = {}) {
  return {
    _id: "promo1",
    branchIds: [],
    status: "ACTIVE",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-06-30T00:00:00.000Z"),
    discountType: "PERCENT",
    discountValue: 10,
    maxDiscountAmount: null,
    minOrderValue: 0,
    applicableRule: { type: "all" },
    stackable: false,
    usageLimit: null,
    usageLimitPerCustomer: null,
    usedCount: 0,
    promoName: "Promo",
    createdAt: NOW,
    ...overrides,
  };
}

function makeItem(overrides = {}) {
  return {
    productItemId: "item1",
    categoryId: "cat1",
    quantity: 1,
    unitPrice: 100000,
    lineTotal: 100000,
    ...overrides,
  };
}

function cartOf(items, extra = {}) {
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { branchId: "branch1", customerId: null, subtotal, items, ...extra };
}

describe("PricingEngine.evaluateEligibility", () => {
  test("excludes inactive promotions", () => {
    const promo = makePromotion({ status: "INACTIVE" });
    const cart = cartOf([makeItem()]);
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(false);
  });

  test("excludes promotions outside the date range", () => {
    const expired = makePromotion({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
    });
    const cart = cartOf([makeItem()]);
    expect(evaluateEligibility(expired, cart, NOW).eligible).toBe(false);
  });

  test("excludes a promotion scoped to a different branch, includes an empty-branchIds (all-branch) promo", () => {
    const otherBranch = makePromotion({ branchIds: ["branch2"] });
    const allBranches = makePromotion({ branchIds: [] });
    const cart = cartOf([makeItem()]);
    expect(evaluateEligibility(otherBranch, cart, NOW).eligible).toBe(false);
    expect(evaluateEligibility(allBranches, cart, NOW).eligible).toBe(true);
  });

  test("includes a multi-branch promotion when the cart's branch is one of several in branchIds", () => {
    const promo = makePromotion({ branchIds: ["branch0", "branch1", "branch2"] });
    const cart = cartOf([makeItem()]); // cart.branchId === "branch1"
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(true);
  });

  test("excludes when cart subtotal is below minOrderValue, includes when subtotal exactly equals it", () => {
    const promo = makePromotion({ minOrderValue: 200000 });
    const below = cartOf([makeItem({ lineTotal: 100000 })]);
    const exact = cartOf([makeItem({ lineTotal: 200000 })]);
    expect(evaluateEligibility(promo, below, NOW).eligible).toBe(false);
    expect(evaluateEligibility(promo, exact, NOW).eligible).toBe(true);
  });

  test("excludes when usageLimit has been reached", () => {
    const promo = makePromotion({ usageLimit: 5, usedCount: 5 });
    const cart = cartOf([makeItem()]);
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(false);
  });

  test("excludes usageLimitPerCustomer promotions when the cart has no customerId", () => {
    const promo = makePromotion({ usageLimitPerCustomer: 1 });
    const cart = cartOf([makeItem()], { customerId: null });
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(false);
  });

  test("includes usageLimitPerCustomer promotions when the cart has a customerId and no prior usage is known", () => {
    const promo = makePromotion({ usageLimitPerCustomer: 1 });
    const cart = cartOf([makeItem()], { customerId: "cust1" });
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(true);
  });

  test("excludes usageLimitPerCustomer promotion once customerUsageCounts shows the cap reached", () => {
    const promo = makePromotion({ _id: "promo1", usageLimitPerCustomer: 2 });
    const cart = cartOf([makeItem()], { customerId: "cust1" });
    expect(evaluateEligibility(promo, cart, NOW, { promo1: 2 }).eligible).toBe(false);
  });

  test("includes usageLimitPerCustomer promotion when customerUsageCounts is still under the cap", () => {
    const promo = makePromotion({ _id: "promo1", usageLimitPerCustomer: 2 });
    const cart = cartOf([makeItem()], { customerId: "cust1" });
    expect(evaluateEligibility(promo, cart, NOW, { promo1: 1 }).eligible).toBe(true);
  });

  test("category rule only matches items in the target category (partial cart match)", () => {
    const promo = makePromotion({
      applicableRule: { type: "category", categoryIds: ["cat1"] },
    });
    const matchingItem = makeItem({ productItemId: "item1", categoryId: "cat1" });
    const otherItem = makeItem({ productItemId: "item2", categoryId: "cat2" });
    const cart = cartOf([matchingItem, otherItem]);
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(true);
  });

  test("category rule excludes the promotion entirely when no cart item matches", () => {
    const promo = makePromotion({
      applicableRule: { type: "category", categoryIds: ["cat-none"] },
    });
    const cart = cartOf([makeItem({ categoryId: "cat1" })]);
    expect(evaluateEligibility(promo, cart, NOW).eligible).toBe(false);
  });

  test("returns a human-readable reason when ineligible", () => {
    const promo = makePromotion({ minOrderValue: 200000 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const { eligible, reason } = evaluateEligibility(promo, cart, NOW);
    expect(eligible).toBe(false);
    expect(typeof reason).toBe("string");
    expect(reason.length).toBeGreaterThan(0);
  });
});

describe("PricingEngine.buildCandidateList", () => {
  test("annotates every promotion with eligibility, reason, and a standalone preview discount", () => {
    const eligible = makePromotion({
      _id: "eligible",
      discountType: "FIXED_AMOUNT",
      discountValue: 20000,
      minOrderValue: 50000,
    });
    const ineligible = makePromotion({
      _id: "ineligible",
      minOrderValue: 999999,
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = buildCandidateList([eligible, ineligible], cart, NOW);

    const eligibleEntry = result.find((e) => e.promotion._id === "eligible");
    const ineligibleEntry = result.find((e) => e.promotion._id === "ineligible");
    expect(eligibleEntry.eligible).toBe(true);
    expect(eligibleEntry.previewDiscount).toBe(20000);
    expect(ineligibleEntry.eligible).toBe(false);
    expect(ineligibleEntry.previewDiscount).toBe(0);
    expect(ineligibleEntry.reason).toBeTruthy();
  });
});

describe("PricingEngine.resolveSelectedPromotions", () => {
  test("returns a zero-discount result when nothing is selected", () => {
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveSelectedPromotions([], [], cart, NOW);
    expect(result).toEqual({
      appliedPromotions: [],
      totalDiscount: 0,
      itemBreakdown: [{ productItemId: "item1", discountAmount: 0 }],
      grandTotal: 100000,
    });
  });

  test("computes a basic PERCENT discount across all items", () => {
    const promo = makePromotion({ discountType: "PERCENT", discountValue: 10 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveSelectedPromotions([promo], ["promo1"], cart, NOW);
    expect(result.totalDiscount).toBe(10000);
    expect(result.grandTotal).toBe(90000);
    expect(result.appliedPromotions).toEqual([
      { promotionId: "promo1", promoName: "Promo", discountAmount: 10000 },
    ]);
  });

  test("FIXED_AMOUNT discount is the full discountValue when subtotal exactly equals minOrderValue (not zero)", () => {
    const promo = makePromotion({
      discountType: "FIXED_AMOUNT",
      discountValue: 200000,
      minOrderValue: 1000000,
    });
    const cart = cartOf([makeItem({ lineTotal: 1000000 })]);
    const result = resolveSelectedPromotions([promo], ["promo1"], cart, NOW);
    expect(result.totalDiscount).toBe(200000);
    expect(result.grandTotal).toBe(800000);
  });

  test("caps a PERCENT discount at maxDiscountAmount", () => {
    const promo = makePromotion({
      discountType: "PERCENT",
      discountValue: 50,
      maxDiscountAmount: 20000,
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveSelectedPromotions([promo], ["promo1"], cart, NOW);
    expect(result.totalDiscount).toBe(20000);
  });

  test("FIXED_AMOUNT discount never exceeds the matched items' subtotal", () => {
    const promo = makePromotion({ discountType: "FIXED_AMOUNT", discountValue: 999999 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveSelectedPromotions([promo], ["promo1"], cart, NOW);
    expect(result.totalDiscount).toBe(100000);
    expect(result.grandTotal).toBe(0);
  });

  test("combines two stackable promotions and clamps per-item discount past 100% of an item's price", () => {
    const promoA = makePromotion({
      _id: "a",
      promoName: "A",
      stackable: true,
      discountType: "PERCENT",
      discountValue: 60,
    });
    const promoB = makePromotion({
      _id: "b",
      promoName: "B",
      stackable: true,
      discountType: "PERCENT",
      discountValue: 60,
    });
    const cart = cartOf([makeItem({ productItemId: "item1", lineTotal: 100000 })]);
    const result = resolveSelectedPromotions([promoA, promoB], ["a", "b"], cart, NOW);
    expect(result.itemBreakdown).toEqual([
      { productItemId: "item1", discountAmount: 100000 },
    ]);
    expect(result.totalDiscount).toBe(100000);
    expect(result.grandTotal).toBe(0);
  });

  test("only discounts the items a category/product rule matched, leaving other items untouched", () => {
    const promo = makePromotion({
      applicableRule: { type: "category", categoryIds: ["cat1"] },
      discountType: "PERCENT",
      discountValue: 10,
    });
    const matched = makeItem({ productItemId: "item1", categoryId: "cat1", lineTotal: 100000 });
    const untouched = makeItem({ productItemId: "item2", categoryId: "cat2", lineTotal: 50000 });
    const cart = cartOf([matched, untouched]);
    const result = resolveSelectedPromotions([promo], ["promo1"], cart, NOW);
    expect(result.itemBreakdown).toEqual(
      expect.arrayContaining([
        { productItemId: "item1", discountAmount: 10000 },
        { productItemId: "item2", discountAmount: 0 },
      ]),
    );
    expect(result.totalDiscount).toBe(10000);
  });

  test("throws when more than 2 promotions are selected", () => {
    const promos = [
      makePromotion({ _id: "a", stackable: true }),
      makePromotion({ _id: "b", stackable: true }),
      makePromotion({ _id: "c", stackable: true }),
    ];
    const cart = cartOf([makeItem()]);
    expect(() => resolveSelectedPromotions(promos, ["a", "b", "c"], cart, NOW)).toThrow();
  });

  test("throws when selecting 2 promotions and at least one isn't stackable", () => {
    const promos = [
      makePromotion({ _id: "a", stackable: true }),
      makePromotion({ _id: "b", stackable: false }),
    ];
    const cart = cartOf([makeItem()]);
    expect(() => resolveSelectedPromotions(promos, ["a", "b"], cart, NOW)).toThrow();
  });

  test("throws when a selected id doesn't match any candidate", () => {
    const promo = makePromotion({ _id: "a" });
    const cart = cartOf([makeItem()]);
    expect(() => resolveSelectedPromotions([promo], ["unknown"], cart, NOW)).toThrow();
  });

  test("throws when a selected promotion is ineligible for this cart", () => {
    const promo = makePromotion({ _id: "a", minOrderValue: 999999 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    expect(() => resolveSelectedPromotions([promo], ["a"], cart, NOW)).toThrow();
  });

  test("deduplicates a repeated id instead of double-applying the discount", () => {
    const promo = makePromotion({ discountType: "FIXED_AMOUNT", discountValue: 10000 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveSelectedPromotions([promo], ["promo1", "promo1"], cart, NOW);
    expect(result.totalDiscount).toBe(10000);
  });
});

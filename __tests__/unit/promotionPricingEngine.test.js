const {
  filterApplicablePromotions,
  resolveStackedDiscount,
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
    priority: 0,
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

describe("PricingEngine.filterApplicablePromotions", () => {
  test("excludes inactive promotions", () => {
    const promos = [makePromotion({ status: "INACTIVE" })];
    const cart = cartOf([makeItem()]);
    expect(filterApplicablePromotions(promos, cart, NOW)).toHaveLength(0);
  });

  test("excludes promotions outside the date range", () => {
    const expired = makePromotion({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
    });
    const cart = cartOf([makeItem()]);
    expect(filterApplicablePromotions([expired], cart, NOW)).toHaveLength(0);
  });

  test("excludes promotions scoped to branches that don't include the cart's branch, keeps empty-branchIds (all-branch) promos", () => {
    const otherBranch = makePromotion({ branchIds: ["branch2"] });
    const allBranches = makePromotion({ branchIds: [] });
    const cart = cartOf([makeItem()]);
    const result = filterApplicablePromotions([otherBranch, allBranches], cart, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].branchIds).toEqual([]);
  });

  test("includes a multi-branch promotion when the cart's branch is one of several in branchIds", () => {
    const promo = makePromotion({ branchIds: ["branch0", "branch1", "branch2"] });
    const cart = cartOf([makeItem()]); // cart.branchId === "branch1"
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(1);
  });

  test("excludes when cart subtotal is below minOrderValue", () => {
    const promo = makePromotion({ minOrderValue: 200000 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(0);
  });

  test("excludes when usageLimit has been reached", () => {
    const promo = makePromotion({ usageLimit: 5, usedCount: 5 });
    const cart = cartOf([makeItem()]);
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(0);
  });

  test("excludes usageLimitPerCustomer promotions when the cart has no customerId", () => {
    const promo = makePromotion({ usageLimitPerCustomer: 1 });
    const cart = cartOf([makeItem()], { customerId: null });
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(0);
  });

  test("includes usageLimitPerCustomer promotions when the cart has a customerId and no prior usage is known", () => {
    const promo = makePromotion({ usageLimitPerCustomer: 1 });
    const cart = cartOf([makeItem()], { customerId: "cust1" });
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(1);
  });

  test("excludes usageLimitPerCustomer promotion once customerUsageCounts shows the cap reached", () => {
    const promo = makePromotion({ _id: "promo1", usageLimitPerCustomer: 2 });
    const cart = cartOf([makeItem()], { customerId: "cust1" });
    const result = filterApplicablePromotions([promo], cart, NOW, { promo1: 2 });
    expect(result).toHaveLength(0);
  });

  test("includes usageLimitPerCustomer promotion when customerUsageCounts is still under the cap", () => {
    const promo = makePromotion({ _id: "promo1", usageLimitPerCustomer: 2 });
    const cart = cartOf([makeItem()], { customerId: "cust1" });
    const result = filterApplicablePromotions([promo], cart, NOW, { promo1: 1 });
    expect(result).toHaveLength(1);
  });

  test("category rule only matches items in the target category (partial cart match)", () => {
    const promo = makePromotion({
      applicableRule: { type: "category", categoryIds: ["cat1"] },
    });
    const matchingItem = makeItem({ productItemId: "item1", categoryId: "cat1" });
    const otherItem = makeItem({ productItemId: "item2", categoryId: "cat2" });
    const cart = cartOf([matchingItem, otherItem]);
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(1);
  });

  test("category rule excludes the promotion entirely when no cart item matches", () => {
    const promo = makePromotion({
      applicableRule: { type: "category", categoryIds: ["cat-none"] },
    });
    const cart = cartOf([makeItem({ categoryId: "cat1" })]);
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(0);
  });

  test("product rule only matches the listed productItemIds", () => {
    const promo = makePromotion({
      applicableRule: { type: "product", productItemIds: ["item1"] },
    });
    const cart = cartOf([
      makeItem({ productItemId: "item1" }),
      makeItem({ productItemId: "item2" }),
    ]);
    expect(filterApplicablePromotions([promo], cart, NOW)).toHaveLength(1);
  });

  test("returns empty array when nothing is eligible", () => {
    const cart = cartOf([makeItem()]);
    expect(filterApplicablePromotions([], cart, NOW)).toEqual([]);
  });
});

describe("PricingEngine.resolveStackedDiscount", () => {
  test("computes a basic PERCENT discount across all items", () => {
    const promo = makePromotion({ discountType: "PERCENT", discountValue: 10 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([promo], cart);
    expect(result.totalDiscount).toBe(10000);
    expect(result.grandTotal).toBe(90000);
    expect(result.appliedPromotions).toEqual([
      { promotionId: "promo1", promoName: "Promo", discountAmount: 10000 },
    ]);
  });

  test("computes a basic FIXED_AMOUNT discount", () => {
    const promo = makePromotion({ discountType: "FIXED_AMOUNT", discountValue: 15000 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([promo], cart);
    expect(result.totalDiscount).toBe(15000);
  });

  test("caps a PERCENT discount at maxDiscountAmount", () => {
    const promo = makePromotion({
      discountType: "PERCENT",
      discountValue: 50,
      maxDiscountAmount: 20000,
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([promo], cart);
    expect(result.totalDiscount).toBe(20000);
  });

  test("FIXED_AMOUNT discount never exceeds the matched items' subtotal", () => {
    const promo = makePromotion({ discountType: "FIXED_AMOUNT", discountValue: 999999 });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([promo], cart);
    expect(result.totalDiscount).toBe(100000);
    expect(result.grandTotal).toBe(0);
  });

  test("returns no discount when there are zero applicable promotions", () => {
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([], cart);
    expect(result).toEqual({
      appliedPromotions: [],
      totalDiscount: 0,
      itemBreakdown: [{ productItemId: "item1", discountAmount: 0 }],
      grandTotal: 100000,
    });
  });

  test("priority: highest-priority NON-stackable promotion wins alone, ignoring a lower-priority stackable one", () => {
    const exclusive = makePromotion({
      _id: "exclusive",
      promoName: "Exclusive",
      priority: 10,
      stackable: false,
      discountType: "FIXED_AMOUNT",
      discountValue: 5000,
    });
    const stackable = makePromotion({
      _id: "stackable",
      promoName: "Stackable",
      priority: 5,
      stackable: true,
      discountType: "FIXED_AMOUNT",
      discountValue: 8000,
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([exclusive, stackable], cart);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].promotionId).toBe("exclusive");
    expect(result.totalDiscount).toBe(5000);
  });

  test("priority: a stackable top promotion layers with subsequent stackable ones, skipping a non-stackable one in between", () => {
    const top = makePromotion({
      _id: "top",
      promoName: "Top",
      priority: 10,
      stackable: true,
      discountType: "FIXED_AMOUNT",
      discountValue: 5000,
    });
    const middleExclusive = makePromotion({
      _id: "middle",
      promoName: "Middle",
      priority: 7,
      stackable: false,
      discountType: "FIXED_AMOUNT",
      discountValue: 4000,
    });
    const bottom = makePromotion({
      _id: "bottom",
      promoName: "Bottom",
      priority: 3,
      stackable: true,
      discountType: "FIXED_AMOUNT",
      discountValue: 2000,
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([top, middleExclusive, bottom], cart);
    const appliedIds = result.appliedPromotions.map((p) => p.promotionId).sort();
    expect(appliedIds).toEqual(["bottom", "top"]);
    expect(result.totalDiscount).toBe(7000);
  });

  test("a non-stackable promotion never combines with anything, even if it's the only one eligible after the top pick", () => {
    const soleExclusive = makePromotion({
      _id: "sole",
      priority: 1,
      stackable: false,
      discountType: "FIXED_AMOUNT",
      discountValue: 3000,
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([soleExclusive], cart);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.totalDiscount).toBe(3000);
  });

  test("clamps per-item discount when two stackable promotions both match the same SKU", () => {
    const promoA = makePromotion({
      _id: "a",
      promoName: "A",
      priority: 2,
      stackable: true,
      discountType: "PERCENT",
      discountValue: 60,
    });
    const promoB = makePromotion({
      _id: "b",
      promoName: "B",
      priority: 1,
      stackable: true,
      discountType: "PERCENT",
      discountValue: 60,
    });
    const item = makeItem({ productItemId: "item1", lineTotal: 100000 });
    const cart = cartOf([item]);
    const result = resolveStackedDiscount([promoA, promoB], cart);
    // 60% + 60% would be 120,000 of a 100,000 item — must clamp to the item's lineTotal.
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
    const result = resolveStackedDiscount([promo], cart);
    expect(result.itemBreakdown).toEqual(
      expect.arrayContaining([
        { productItemId: "item1", discountAmount: 10000 },
        { productItemId: "item2", discountAmount: 0 },
      ]),
    );
    expect(result.totalDiscount).toBe(10000);
  });

  test("deterministic tie-break by createdAt when priority and discount amount are equal", () => {
    const older = makePromotion({
      _id: "older",
      priority: 1,
      stackable: false,
      discountType: "FIXED_AMOUNT",
      discountValue: 1000,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = makePromotion({
      _id: "newer",
      priority: 1,
      stackable: false,
      discountType: "FIXED_AMOUNT",
      discountValue: 1000,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const cart = cartOf([makeItem({ lineTotal: 100000 })]);
    const result = resolveStackedDiscount([newer, older], cart);
    expect(result.appliedPromotions[0].promotionId).toBe("older");
  });
});

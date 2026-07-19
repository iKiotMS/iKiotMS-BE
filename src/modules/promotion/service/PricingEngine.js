/**
 * Pure discount-calculation engine — no Mongoose/DB access.
 * Callers (PromotionService) are responsible for fetching candidate promotions
 * and resolving productItemId -> categoryId before calling into this module.
 *
 * Promotion application is always explicit: the caller passes the exact set of
 * promotionIds to apply (chosen by the user in the UI) rather than this module
 * auto-picking a "best" combination by priority.
 */

function round(amount) {
  return Math.round(amount);
}

function ruleMatchesItem(applicableRule, item) {
  if (applicableRule.type === "all") return true;
  if (applicableRule.type === "category") {
    return (applicableRule.categoryIds || []).some(
      (id) => String(id) === String(item.categoryId),
    );
  }
  if (applicableRule.type === "product") {
    return (applicableRule.productItemIds || []).some(
      (id) => String(id) === String(item.productItemId),
    );
  }
  return false;
}

function getMatchedItems(promotion, items) {
  return items.filter((item) => ruleMatchesItem(promotion.applicableRule, item));
}

function isWithinDateRange(promotion, now) {
  return now >= new Date(promotion.startDate) && now <= new Date(promotion.endDate);
}

function matchedSubtotal(matchedItems) {
  return matchedItems.reduce((sum, item) => sum + item.lineTotal, 0);
}

function rawDiscount(promotion, matchedItems) {
  const subtotal = matchedSubtotal(matchedItems);
  if (promotion.discountType === "PERCENT") {
    const amount = (subtotal * promotion.discountValue) / 100;
    const capped =
      promotion.maxDiscountAmount != null
        ? Math.min(amount, promotion.maxDiscountAmount)
        : amount;
    return round(capped);
  }
  // FIXED_AMOUNT — never discount more than the matched items are worth.
  return round(Math.min(promotion.discountValue, subtotal));
}

/**
 * Evaluates a single promotion against the cart, returning why it can/can't be
 * applied. cartContext: { branchId, customerId?, subtotal, items: [{productItemId,
 * categoryId, quantity, unitPrice, lineTotal}] }. customerUsageCounts: { [promotionId]:
 * number } — how many times cartContext.customerId has already used each promotion
 * (pre-fetched by the caller from PromotionLog, since this module stays DB-free).
 * Only needs entries for promotions that actually set usageLimitPerCustomer.
 */
function evaluateEligibility(promotion, cartContext, now = new Date(), customerUsageCounts = {}) {
  if (promotion.status !== "ACTIVE") {
    return { eligible: false, reason: "Khuyến mãi không hoạt động" };
  }
  if (!isWithinDateRange(promotion, now)) {
    return { eligible: false, reason: "Khuyến mãi chưa bắt đầu hoặc đã kết thúc" };
  }
  // Empty/missing branchIds = applies tenant-wide. Non-empty = only at those branches.
  if (
    promotion.branchIds &&
    promotion.branchIds.length > 0 &&
    !promotion.branchIds.some((id) => String(id) === String(cartContext.branchId))
  ) {
    return { eligible: false, reason: "Không áp dụng cho chi nhánh này" };
  }
  if (cartContext.subtotal < (promotion.minOrderValue || 0)) {
    const minOrderLabel = (promotion.minOrderValue || 0).toLocaleString("vi-VN");
    return {
      eligible: false,
      reason: `Đơn hàng chưa đạt giá trị tối thiểu ${minOrderLabel}đ`,
    };
  }
  if (promotion.usageLimit != null && (promotion.usedCount || 0) >= promotion.usageLimit) {
    return { eligible: false, reason: "Khuyến mãi đã hết lượt sử dụng" };
  }
  if (promotion.usageLimitPerCustomer != null) {
    // A per-customer usage cap is meaningless without knowing who the customer is —
    // exclude rather than silently skip the check for anonymous/walk-in carts.
    if (!cartContext.customerId) {
      return { eligible: false, reason: "Cần chọn khách hàng để áp dụng khuyến mãi này" };
    }
    const usedByCustomer = customerUsageCounts[String(promotion._id)] || 0;
    if (usedByCustomer >= promotion.usageLimitPerCustomer) {
      return { eligible: false, reason: "Khách hàng đã hết lượt sử dụng khuyến mãi này" };
    }
  }
  if (getMatchedItems(promotion, cartContext.items).length === 0) {
    return { eligible: false, reason: "Không áp dụng cho sản phẩm trong giỏ hàng" };
  }
  return { eligible: true, reason: null };
}

/**
 * Builds the full candidate list for a cart — every promotion the caller fetched,
 * annotated with eligibility + a standalone (non-stacked) preview discount amount.
 * Used by the "browse promotions to assign" listing endpoint.
 */
function buildCandidateList(promotions, cartContext, now = new Date(), customerUsageCounts = {}) {
  return promotions.map((promotion) => {
    const { eligible, reason } = evaluateEligibility(promotion, cartContext, now, customerUsageCounts);
    const matchedItems = getMatchedItems(promotion, cartContext.items);
    const previewDiscount = eligible ? rawDiscount(promotion, matchedItems) : 0;
    return { promotion, eligible, reason, matchedItems, previewDiscount };
  });
}

/**
 * Distributes each applied promotion's discount across the items it matched
 * (proportional to each item's share of the matched subtotal), then clamps
 * each item's ACCUMULATED discount to its own lineTotal — this prevents two
 * stackable promotions that both match the same SKU from discounting it past
 * 100% of its price.
 */
function allocatePerItemDiscount(appliedEntries) {
  const perItem = new Map();

  for (const { matchedItems, discount } of appliedEntries) {
    const subtotal = matchedSubtotal(matchedItems);
    if (subtotal <= 0 || discount <= 0) continue;
    for (const item of matchedItems) {
      const share = round((item.lineTotal / subtotal) * discount);
      const current = perItem.get(item.productItemId) || 0;
      perItem.set(item.productItemId, current + share);
    }
  }

  for (const item of appliedEntries.flatMap((e) => e.matchedItems)) {
    const current = perItem.get(item.productItemId) || 0;
    if (current > item.lineTotal) {
      perItem.set(item.productItemId, item.lineTotal);
    }
  }

  return perItem;
}

function emptyResult(cartContext) {
  return {
    appliedPromotions: [],
    totalDiscount: 0,
    itemBreakdown: cartContext.items.map((item) => ({
      productItemId: item.productItemId,
      discountAmount: 0,
    })),
    grandTotal: round(cartContext.subtotal),
  };
}

/**
 * Resolves an explicit, user-chosen set of promotionIds against the cart.
 * promotions: candidate promotions the caller fetched (tenant-wide + this branch).
 * selectedIds: at most 2 promotion ids; if 2, both must be stackable.
 * Throws a descriptive Error if a selected id is unknown/ineligible, or if the
 * combination breaks the stacking/count rules — callers should surface this as 400.
 */
function resolveSelectedPromotions(promotions, selectedIds, cartContext, now = new Date(), customerUsageCounts = {}) {
  const uniqueIds = [...new Set((selectedIds || []).map(String))];
  if (uniqueIds.length === 0) {
    return emptyResult(cartContext);
  }
  if (uniqueIds.length > 2) {
    throw new Error("Chỉ được chọn tối đa 2 khuyến mãi cộng dồn");
  }

  const promotionById = new Map(promotions.map((p) => [String(p._id), p]));
  const resolved = uniqueIds.map((id) => {
    const promotion = promotionById.get(id);
    if (!promotion) {
      throw new Error("Một khuyến mãi đã chọn không còn tồn tại hoặc không áp dụng cho đơn này");
    }
    const { eligible, reason } = evaluateEligibility(promotion, cartContext, now, customerUsageCounts);
    if (!eligible) {
      throw new Error(`Khuyến mãi "${promotion.promoName}" không đủ điều kiện: ${reason}`);
    }
    return promotion;
  });

  if (resolved.length > 1 && !resolved.every((p) => p.stackable)) {
    throw new Error("Chỉ có thể chọn thêm khuyến mãi được phép cộng dồn (stackable)");
  }

  const computed = resolved.map((promotion) => {
    const matchedItems = getMatchedItems(promotion, cartContext.items);
    return { promotion, matchedItems, discount: rawDiscount(promotion, matchedItems) };
  });

  const perItem = allocatePerItemDiscount(computed);

  const itemBreakdown = cartContext.items.map((item) => ({
    productItemId: item.productItemId,
    discountAmount: perItem.get(item.productItemId) || 0,
  }));

  const totalDiscount = Math.min(
    itemBreakdown.reduce((sum, i) => sum + i.discountAmount, 0),
    cartContext.subtotal,
  );

  return {
    appliedPromotions: computed.map(({ promotion, discount }) => ({
      promotionId: promotion._id,
      promoName: promotion.promoName,
      discountAmount: discount,
    })),
    totalDiscount: round(totalDiscount),
    itemBreakdown,
    grandTotal: round(cartContext.subtotal - totalDiscount),
  };
}

module.exports = {
  ruleMatchesItem,
  getMatchedItems,
  isWithinDateRange,
  matchedSubtotal,
  rawDiscount,
  evaluateEligibility,
  buildCandidateList,
  allocatePerItemDiscount,
  resolveSelectedPromotions,
};

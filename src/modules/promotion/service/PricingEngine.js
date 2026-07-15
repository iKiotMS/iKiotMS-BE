/**
 * Pure discount-calculation engine — no Mongoose/DB access.
 * Callers (PromotionService) are responsible for fetching candidate promotions
 * and resolving productItemId -> categoryId before calling into this module.
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

/**
 * Filters the tenant's candidate promotions down to the ones eligible for this cart.
 * cartContext: { branchId, customerId?, subtotal, items: [{productItemId, categoryId, quantity, unitPrice, lineTotal}] }
 * customerUsageCounts: { [promotionId]: number } — how many times cartContext.customerId
 * has already used each promotion (pre-fetched by the caller from PromotionLog, since this
 * module intentionally stays DB-free). Only needs entries for promotions that actually set
 * usageLimitPerCustomer; missing entries are treated as 0.
 */
function filterApplicablePromotions(promotions, cartContext, now = new Date(), customerUsageCounts = {}) {
  return promotions.filter((promotion) => {
    if (promotion.status !== "ACTIVE") return false;
    if (!isWithinDateRange(promotion, now)) return false;
    // Empty/missing branchIds = applies tenant-wide. Non-empty = only at those branches.
    if (
      promotion.branchIds &&
      promotion.branchIds.length > 0 &&
      !promotion.branchIds.some((id) => String(id) === String(cartContext.branchId))
    ) {
      return false;
    }
    if (cartContext.subtotal < (promotion.minOrderValue || 0)) return false;
    if (
      promotion.usageLimit != null &&
      (promotion.usedCount || 0) >= promotion.usageLimit
    ) {
      return false;
    }
    if (promotion.usageLimitPerCustomer != null) {
      // A per-customer usage cap is meaningless without knowing who the customer is —
      // exclude rather than silently skip the check for anonymous/walk-in carts.
      if (!cartContext.customerId) return false;
      const usedByCustomer = customerUsageCounts[String(promotion._id)] || 0;
      if (usedByCustomer >= promotion.usageLimitPerCustomer) return false;
    }
    return getMatchedItems(promotion, cartContext.items).length > 0;
  });
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
 * Sorts by priority DESC, then computed discount DESC, then createdAt ASC, then _id ASC —
 * fully deterministic so equal-priority ties resolve the same way every time.
 */
function sortByPriority(computed) {
  return [...computed].sort((a, b) => {
    if (b.promotion.priority !== a.promotion.priority) {
      return b.promotion.priority - a.promotion.priority;
    }
    if (b.discount !== a.discount) return b.discount - a.discount;
    const aCreated = new Date(a.promotion.createdAt || 0).getTime();
    const bCreated = new Date(b.promotion.createdAt || 0).getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;
    return String(a.promotion._id).localeCompare(String(b.promotion._id));
  });
}

/**
 * Priority-driven resolution: the highest-priority promotion always applies first.
 * If it is non-stackable, it wins alone and resolution stops there. If it is
 * stackable, keep layering subsequent stackable promotions (in priority order),
 * skipping any further non-stackable ones encountered along the way.
 */
function pickAppliedPromotions(sortedComputed) {
  const applied = [];
  for (const entry of sortedComputed) {
    if (applied.length === 0) {
      applied.push(entry);
      if (!entry.promotion.stackable) break;
    } else if (entry.promotion.stackable) {
      applied.push(entry);
    }
  }
  return applied;
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

/**
 * applicable: promotions already filtered by filterApplicablePromotions.
 * Returns { appliedPromotions, totalDiscount, itemBreakdown, grandTotal }.
 */
function resolveStackedDiscount(applicable, cartContext) {
  const computed = applicable.map((promotion) => {
    const matchedItems = getMatchedItems(promotion, cartContext.items);
    return { promotion, matchedItems, discount: rawDiscount(promotion, matchedItems) };
  });

  const sorted = sortByPriority(computed);
  const applied = pickAppliedPromotions(sorted);
  const perItem = allocatePerItemDiscount(applied);

  const itemBreakdown = cartContext.items.map((item) => ({
    productItemId: item.productItemId,
    discountAmount: perItem.get(item.productItemId) || 0,
  }));

  const totalDiscount = Math.min(
    itemBreakdown.reduce((sum, i) => sum + i.discountAmount, 0),
    cartContext.subtotal,
  );

  return {
    appliedPromotions: applied.map(({ promotion, discount }) => ({
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
  filterApplicablePromotions,
  resolveStackedDiscount,
  ruleMatchesItem,
};

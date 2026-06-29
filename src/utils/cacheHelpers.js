const redisClient = require("../config/redis");

// Serializes query params in sorted order so ?page=1&limit=10 and ?limit=10&page=1
// produce the same cache key.
const stableQuery = (query) =>
  Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");

const cacheKeys = {
  // Subscription plans (global, no tenantId)
  plansAll: () => "plans:all",

  // Brands (global, no tenantId)
  brandList: (query) => `brands:list:${stableQuery(query)}`,
  brandDetail: (id) => `brand:detail:${id}`,

  // Categories (global, no tenantId)
  categoryList: (query) => `categories:list:${stableQuery(query)}`,
  categoryDetail: (id) => `category:detail:${id}`,
  categoryTree: () => "categories:tree",

  // Branches (tenant-scoped)
  branchList: (tenantId, query) =>
    `branches:list:${tenantId}:${stableQuery(query)}`,
  branchDetail: (tenantId, id) => `branch:detail:${tenantId}:${id}`,

  // Warehouses (tenant-scoped)
  warehouseList: (tenantId, query) =>
    `warehouses:list:${tenantId}:${stableQuery(query)}`,
  warehouseDetail: (tenantId, id) => `warehouse:detail:${tenantId}:${id}`,

  // Shift templates (tenant-scoped)
  shiftTemplateList: (tenantId, query) =>
    `shift-templates:list:${tenantId}:${stableQuery(query)}`,
  shiftTemplateDetail: (tenantId, id) =>
    `shift-template:detail:${tenantId}:${id}`,

  // Staff roles (depends on the requester's role, not tenant)
  staffRoles: (role) => `staff:roles:${role}`,
};

/**
 * Deletes all Redis keys matching a glob pattern using non-blocking SCAN + UNLINK.
 * Used to invalidate all list variants after a mutation (create/update/delete).
 */
const deleteByPattern = async (pattern) => {
  if (!redisClient.isReady) return;
  try {
    const keys = [];
    for await (const key of redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await redisClient.unlink(keys);
    }
  } catch {
    // Redis unavailable — skip invalidation silently
  }
};

/**
 * Deletes one or more specific Redis keys by exact name.
 * Used to invalidate a single detail key after update/delete.
 */
const deleteKeys = async (...keys) => {
  if (!redisClient.isReady) return;
  const valid = keys.filter(Boolean);
  if (valid.length === 0) return;
  try {
    await redisClient.unlink(valid);
  } catch {
    // Redis unavailable — skip invalidation silently
  }
};

module.exports = { cacheKeys, deleteByPattern, deleteKeys };

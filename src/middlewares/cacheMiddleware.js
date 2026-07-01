const redisClient = require("../config/redis");

/**
 * Express middleware factory that caches JSON responses in Redis.
 * - keyFn(req) → string: computes the cache key from the request
 * - ttlSeconds: how long to keep the cached value
 * Gracefully skips caching when Redis is unavailable.
 */
const cacheResponse = (keyFn, ttlSeconds) => async (req, res, next) => {
  if (!redisClient.isReady) return next();

  const key = keyFn(req);

  try {
    const cached = await redisClient.get(key);
    if (cached !== null) {
      return res.json(JSON.parse(cached));
    }
  } catch {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 200 && redisClient.isReady) {
      redisClient
        .set(key, JSON.stringify(body), { EX: ttlSeconds })
        .catch(() => {});
    }
    return originalJson(body);
  };

  next();
};

module.exports = { cacheResponse };

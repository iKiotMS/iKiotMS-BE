const express = require("express");
const redisClient = require("../config/redis.js");

const router = express.Router();

/**
 * @openapi
 * /redis-test:
 *   get:
 *     tags:
 *       - Utils
 *     summary: Test Redis connection
 *     description: Writes a temporary Redis key, reads it back, and returns the stored value.
 *     responses:
 *       200:
 *         description: Redis test completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: string
 *                   example: hello
 *       500:
 *         description: Redis test failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Redis test failed
 */
router.get("/", async (req, res) => {
  try {
    await redisClient.set("test:key", "hello", { EX: 60 });
    const value = await redisClient.get("test:key");
    res.json({ value });
  } catch (error) {
    console.error("Redis test error:", error);
    res.status(500).json({ error: "Redis test failed" });
  }
});

module.exports = router;

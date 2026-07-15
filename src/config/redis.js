const { createClient } = require("redis");
require("dotenv").config();

// Connect to your Key Value instance using the REDIS_URL environment variable
// The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379

if (!process.env.REDIS_URL) {
  console.log(
    "Redis notice: REDIS_URL not set. Redis features will be disabled.",
  );
}

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    tls: process.env.REDIS_URL && process.env.REDIS_URL.startsWith("rediss://"),
    rejectUnauthorized: false,
    connectTimeout: 50000,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.log("Redis: Max reconnection attempts reached. Giving up.");
        return false; // Stop reconnecting
      }
      return Math.min(retries * 500, 3000);
    },
  },
  pingInterval: 1000 * 60 * 4, // Ping every 4 minutes to keep connection alive
});

let hasPrintedSocketError = false;

redisClient.on("error", (err) => {
  if (err.name === "SocketClosedUnexpectedlyError") {
    if (!hasPrintedSocketError) {
      console.log(
        "Redis notice: Socket closed unexpectedly. Client will auto-reconnect...",
      );
      hasPrintedSocketError = true;
    }
  } else if (!hasPrintedSocketError) {
    console.log("Redis Client Error:", err.message || err.code);
    hasPrintedSocketError = true;
  }
});

redisClient.on("ready", () => {
  hasPrintedSocketError = false; // Reset the flag once it successfully reconnects
});

// Redis temporarily disabled — auto-connect commented out.
// redisClient.isReady stays false, so all consumers (cache middleware, OTP
// storage) degrade gracefully to in-memory / no-cache. Un-comment to re-enable.
// (async () => {
//   try {
//     await redisClient.connect();
//
//     // Set and retrieve some values
//     await redisClient.set("key", "node redis");
//     const value = await redisClient.get("key");
//     console.log("Redis connected. Test key value:", value);
//   } catch (error) {
//     console.log(
//       "Redis connection failed:",
//       error.message || error.code,
//       "- App will continue without Redis.",
//     );
//   }
// })();

module.exports = redisClient;

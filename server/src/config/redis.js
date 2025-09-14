import Redis from "ioredis";
import logger from "../utils/logger.js";

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redisOptions = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

export async function connectRedis() {
  try {
    // Main client for general operations
    redisClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: "main",
    });

    // Pub/Sub clients for cross-server communication
    redisPubClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: "publisher",
    });

    redisSubClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: "subscriber",
    });

    // Event handlers
    redisClient.on("connect", () => {
      logger.info("Redis client connected");
    });

    redisClient.on("error", (err) => {
      logger.error("Redis client error:", err);
    });

    redisClient.on("ready", () => {
      logger.info("Redis client ready");
    });

    // Wait for connections
    await Promise.all([
      redisClient.ping(),
      redisPubClient.ping(),
      redisSubClient.ping(),
    ]);

    logger.info("All Redis connections established");
  } catch (error) {
    logger.error("Redis connection failed:", error);
    // Continue without Redis (fallback to in-memory)
    logger.warn("Running without Redis - using in-memory fallback");
  }
}

export function getRedisClient() {
  return redisClient;
}

export function getRedisPubClient() {
  return redisPubClient;
}

export function getRedisSubClient() {
  return redisSubClient;
}

export async function disconnectRedis() {
  try {
    if (redisClient) await redisClient.quit();
    if (redisPubClient) await redisPubClient.quit();
    if (redisSubClient) await redisSubClient.quit();
    logger.info("Redis disconnected gracefully");
  } catch (error) {
    logger.error("Error disconnecting Redis:", error);
  }
}

// Helper functions for common Redis operations
export const RedisHelper = {
  async setWithTTL(key, value, ttl) {
    if (!redisClient) return null;
    try {
      const stringValue =
        typeof value === "object" ? JSON.stringify(value) : value;
      await redisClient.setex(key, ttl, stringValue);
      return true;
    } catch (error) {
      logger.error("Redis SET error:", error);
      return false;
    }
  },

  async get(key) {
    if (!redisClient) return null;
    try {
      const value = await redisClient.get(key);
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  },

  async delete(key) {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error("Redis DELETE error:", error);
      return false;
    }
  },

  async addToSet(key, ...members) {
    if (!redisClient) return false;
    try {
      await redisClient.sadd(key, ...members);
      return true;
    } catch (error) {
      logger.error("Redis SADD error:", error);
      return false;
    }
  },

  async removeFromSet(key, ...members) {
    if (!redisClient) return false;
    try {
      await redisClient.srem(key, ...members);
      return true;
    } catch (error) {
      logger.error("Redis SREM error:", error);
      return false;
    }
  },

  async getSetMembers(key) {
    if (!redisClient) return [];
    try {
      return await redisClient.smembers(key);
    } catch (error) {
      logger.error("Redis SMEMBERS error:", error);
      return [];
    }
  },

  async exists(key) {
    if (!redisClient) return false;
    try {
      return (await redisClient.exists(key)) === 1;
    } catch (error) {
      logger.error("Redis EXISTS error:", error);
      return false;
    }
  },

  async increment(key) {
    if (!redisClient) return 0;
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.error("Redis INCR error:", error);
      return 0;
    }
  },
};

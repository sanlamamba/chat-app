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
  const startTime = Date.now();

  try {
    logger.info("Connecting to Redis", {
      service: "redis",
      url: REDIS_URL.replace(/\/\/.*@/, "//***:***@"),
    });

    redisClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: "main",
    });

    redisPubClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: "publisher",
    });

    redisSubClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: "subscriber",
    });

    redisClient.on("connect", () => {
      logger.info("Redis client connected", {
        service: "redis",
        client: "main",
      });
    });

    redisClient.on("error", (err) => {
      logger.error("Redis client error", {
        service: "redis",
        client: "main",
        error: err.message,
      });
    });

    redisClient.on("ready", () => {
      logger.info("Redis client ready", { service: "redis", client: "main" });
    });

    await Promise.all([
      redisClient.ping(),
      redisPubClient.ping(),
      redisSubClient.ping(),
    ]);

    const duration = Date.now() - startTime;
    logger.info("Redis connections established", {
      service: "redis",
      duration,
      clients: ["main", "publisher", "subscriber"],
    });
  } catch (error) {
    logger.error("Redis connection failed", {
      service: "redis",
      error: error.message,
      duration: Date.now() - startTime,
    });
    logger.warn("Running without Redis - using in-memory fallback", {
      service: "redis",
    });
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
    logger.info("Disconnecting from Redis", { service: "redis" });
    if (redisClient) await redisClient.quit();
    if (redisPubClient) await redisPubClient.quit();
    if (redisSubClient) await redisSubClient.quit();
    logger.info("Redis disconnected gracefully", { service: "redis" });
  } catch (error) {
    logger.error("Error disconnecting Redis", {
      service: "redis",
      error: error.message,
    });
  }
}

export const RedisHelper = {
  async setWithTTL(key, value, ttl) {
    if (!redisClient) return null;
    try {
      const stringValue =
        typeof value === "object" ? JSON.stringify(value) : value;
      await redisClient.setex(key, ttl, stringValue);
      return true;
    } catch (error) {
      logger.debug("Redis SET operation failed", {
        service: "redis",
        operation: "setex",
        key,
        error: error.message,
      });
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
      logger.debug("Redis GET operation failed", {
        service: "redis",
        operation: "get",
        key,
        error: error.message,
      });
      return null;
    }
  },

  async delete(key) {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.debug("Redis DELETE operation failed", {
        service: "redis",
        operation: "del",
        key,
        error: error.message,
      });
      return false;
    }
  },

  async addToSet(key, ...members) {
    if (!redisClient) return false;
    try {
      await redisClient.sadd(key, ...members);
      return true;
    } catch (error) {
      logger.debug("Redis SADD operation failed", {
        service: "redis",
        operation: "sadd",
        key,
        error: error.message,
      });
      return false;
    }
  },

  async removeFromSet(key, ...members) {
    if (!redisClient) return false;
    try {
      await redisClient.srem(key, ...members);
      return true;
    } catch (error) {
      logger.debug("Redis SREM operation failed", {
        service: "redis",
        operation: "srem",
        key,
        error: error.message,
      });
      return false;
    }
  },

  async getSetMembers(key) {
    if (!redisClient) return [];
    try {
      return await redisClient.smembers(key);
    } catch (error) {
      logger.debug("Redis SMEMBERS operation failed", {
        service: "redis",
        operation: "smembers",
        key,
        error: error.message,
      });
      return [];
    }
  },

  async exists(key) {
    if (!redisClient) return false;
    try {
      return (await redisClient.exists(key)) === 1;
    } catch (error) {
      logger.debug("Redis EXISTS operation failed", {
        service: "redis",
        operation: "exists",
        key,
        error: error.message,
      });
      return false;
    }
  },

  async increment(key) {
    if (!redisClient) return 0;
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.debug("Redis INCR operation failed", {
        service: "redis",
        operation: "incr",
        key,
        error: error.message,
      });
      return 0;
    }
  },
};

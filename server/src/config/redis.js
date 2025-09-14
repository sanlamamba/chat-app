import Redis from 'ioredis';
import logger from '../utils/logger.js';
import { redisCircuitBreaker } from '../utils/circuitBreaker.js';

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,
  family: 4,
  enableAutoPipelining: true,
  maxMemoryPolicy: 'allkeys-lru'
};

export async function connectRedis() {
  const startTime = Date.now();

  try {
    logger.info('Connecting to Redis', {
      service: 'redis',
      url: REDIS_URL.replace(/\/\/.*@/, '//***:***@')
    });

    redisClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: 'main'
    });

    redisPubClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: 'publisher'
    });

    redisSubClient = new Redis(REDIS_URL, {
      ...redisOptions,
      connectionName: 'subscriber'
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected', {
        service: 'redis',
        client: 'main'
      });
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', {
        service: 'redis',
        client: 'main',
        error: err.message
      });
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready', { service: 'redis', client: 'main' });
    });

    await Promise.all([
      redisClient.ping(),
      redisPubClient.ping(),
      redisSubClient.ping()
    ]);

    const duration = Date.now() - startTime;
    logger.info('Redis connections established', {
      service: 'redis',
      duration,
      clients: ['main', 'publisher', 'subscriber']
    });
  } catch (error) {
    logger.error('Redis connection failed', {
      service: 'redis',
      error: error.message,
      duration: Date.now() - startTime
    });
    logger.warn('Running without Redis - using in-memory fallback', {
      service: 'redis'
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
    logger.info('Disconnecting from Redis', { service: 'redis' });
    if (redisClient) await redisClient.quit();
    if (redisPubClient) await redisPubClient.quit();
    if (redisSubClient) await redisSubClient.quit();
    logger.info('Redis disconnected gracefully', { service: 'redis' });
  } catch (error) {
    logger.error('Error disconnecting Redis', {
      service: 'redis',
      error: error.message
    });
  }
}

export const RedisHelper = {
  async setWithTTL(key, value, ttl) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        const stringValue =
          typeof value === 'object' ? JSON.stringify(value) : value;
        await redisClient.setex(key, ttl, stringValue);
        return true;
      },
      async () => {
        logger.debug('Redis SET fallback - operation skipped', {
          service: 'redis',
          operation: 'setex',
          key
        });
        return false;
      }
    );
  },

  async get(key) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        const value = await redisClient.get(key);
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
      async () => {
        logger.debug('Redis GET fallback - returning null', {
          service: 'redis',
          operation: 'get',
          key
        });
        return null;
      }
    );
  },

  async delete(key) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        await redisClient.del(key);
        return true;
      },
      async () => {
        logger.debug('Redis DELETE fallback - operation skipped', {
          service: 'redis',
          operation: 'del',
          key
        });
        return false;
      }
    );
  },

  async addToSet(key, ...members) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        await redisClient.sadd(key, ...members);
        return true;
      },
      async () => {
        logger.debug('Redis SADD fallback - operation skipped', {
          service: 'redis',
          operation: 'sadd',
          key
        });
        return false;
      }
    );
  },

  async removeFromSet(key, ...members) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        await redisClient.srem(key, ...members);
        return true;
      },
      async () => {
        logger.debug('Redis SREM fallback - operation skipped', {
          service: 'redis',
          operation: 'srem',
          key
        });
        return false;
      }
    );
  },

  async getSetMembers(key) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        return await redisClient.smembers(key);
      },
      async () => {
        logger.debug('Redis SMEMBERS fallback - returning empty array', {
          service: 'redis',
          operation: 'smembers',
          key
        });
        return [];
      }
    );
  },

  async exists(key) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        return (await redisClient.exists(key)) === 1;
      },
      async () => {
        logger.debug('Redis EXISTS fallback - returning false', {
          service: 'redis',
          operation: 'exists',
          key
        });
        return false;
      }
    );
  },

  async increment(key) {
    return redisCircuitBreaker.execute(
      async () => {
        if (!redisClient) throw new Error('Redis client not available');
        return await redisClient.incr(key);
      },
      async () => {
        logger.debug('Redis INCR fallback - returning 0', {
          service: 'redis',
          operation: 'incr',
          key
        });
        return 0;
      }
    );
  },

  getCircuitBreakerMetrics() {
    return redisCircuitBreaker.getMetrics();
  }
};

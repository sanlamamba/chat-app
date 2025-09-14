import { RedisHelper } from '../config/redis.js';
import logger from './logger.js';
import { CONSTANTS } from '../config/constants.js';

export class CacheManager {
  constructor() {
    this.localCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      warmups: 0
    };

    this.dependencies = new Map();
    this.reverseDependencies = new Map();

    this.setupCleanup();
  }

  async get(key, fallbackFn = null) {
    if (this.localCache.has(key)) {
      const entry = this.localCache.get(key);
      if (entry.expiresAt > Date.now()) {
        this.cacheStats.hits++;
        logger.debug('Cache hit (L1)', { service: 'cache', key });
        return entry.value;
      } else {
        this.localCache.delete(key);
      }
    }

    const redisValue = await RedisHelper.get(key);
    if (redisValue !== null) {
      this.setLocal(key, redisValue, 60000);
      this.cacheStats.hits++;
      logger.debug('Cache hit (L2)', { service: 'cache', key });
      return redisValue;
    }

    this.cacheStats.misses++;

    if (fallbackFn) {
      try {
        const value = await fallbackFn();
        if (value !== null && value !== undefined) {
          await this.set(key, value, CONSTANTS.CACHE_TTL.ROOM_INFO);
        }
        return value;
      } catch (error) {
        logger.error('Cache fallback error', {
          service: 'cache',
          key,
          error: error.message
        });
        return null;
      }
    }

    return null;
  }

  async set(key, value, ttl = 300, dependencies = []) {
    await RedisHelper.setWithTTL(key, value, ttl);

    const localTtl = Math.min(ttl * 1000, 300000);
    this.setLocal(key, value, localTtl);

    this.trackDependencies(key, dependencies);

    this.cacheStats.sets++;
    logger.debug('Cache set', { service: 'cache', key, ttl });
  }

  setLocal(key, value, ttl = 60000) {
    this.localCache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  async invalidate(key, cascade = true) {
    this.localCache.delete(key);

    await RedisHelper.delete(key);

    this.cacheStats.invalidations++;

    if (cascade) {
      const dependents = this.dependencies.get(key) || new Set();
      for (const dependent of dependents) {
        await this.invalidate(dependent, false);
      }
    }

    this.cleanupDependencies(key);

    logger.debug('Cache invalidated', { service: 'cache', key, cascade });
  }

  async invalidatePattern(pattern) {
    const keys = [];

    for (const [key] of this.localCache) {
      if (this.matchPattern(key, pattern)) {
        keys.push(key);
      }
    }

    await Promise.all(keys.map((key) => this.invalidate(key)));

    logger.debug('Cache pattern invalidated', {
      service: 'cache',
      pattern,
      count: keys.length
    });
  }

  async warmCache(warmupStrategies = {}) {
    logger.info('Starting cache warmup', { service: 'cache' });

    const startTime = Date.now();
    let warmedCount = 0;

    try {
      if (warmupStrategies.rooms !== false) {
        warmedCount += await this.warmRoomsCache();
      }

      if (warmupStrategies.users !== false) {
        warmedCount += await this.warmUsersCache();
      }

      if (warmupStrategies.messages !== false) {
        warmedCount += await this.warmMessagesCache();
      }

      const duration = Date.now() - startTime;
      this.cacheStats.warmups++;

      logger.info('Cache warmup completed', {
        service: 'cache',
        duration,
        warmedCount
      });
    } catch (error) {
      logger.error('Cache warmup failed', {
        service: 'cache',
        error: error.message
      });
    }
  }

  async warmRoomsCache() {
    try {
      const { Room } = await import('../models/Room.js');
      const rooms = await Room.find({ isActive: true }).limit(50).lean();

      let count = 0;
      for (const room of rooms) {
        const roomInfo = {
          id: room.roomId,
          name: room.name,
          userCount: room.metadata.currentUsers,
          messageCount: room.metadata.messageCount,
          createdAt: room.createdAt,
          isActive: room.isActive
        };

        await this.set(
          `room:${room.roomId}:info`,
          roomInfo,
          CONSTANTS.CACHE_TTL.ROOM_INFO
        );
        count++;
      }

      return count;
    } catch (error) {
      logger.error('Failed to warm rooms cache', {
        service: 'cache',
        error: error.message
      });
      return 0;
    }
  }

  async warmUsersCache() {
    try {
      const { User } = await import('../models/User.js');
      const users = await User.find({ isOnline: true }).limit(100).lean();

      let count = 0;
      for (const user of users) {
        await this.set(
          `user:${user.userId}:info`,
          {
            userId: user.userId,
            username: user.username,
            isOnline: user.isOnline,
            currentRoom: user.currentRoom
          },
          CONSTANTS.CACHE_TTL.USER_INFO
        );
        count++;
      }

      return count;
    } catch (error) {
      logger.error('Failed to warm users cache', {
        service: 'cache',
        error: error.message
      });
      return 0;
    }
  }

  async warmMessagesCache() {
    try {
      const { Room } = await import('../models/Room.js');
      const { Message } = await import('../models/Message.js');

      const activeRooms = await Room.find({ isActive: true }).limit(20).lean();

      let count = 0;
      for (const room of activeRooms) {
        const messages = await Message.find({ roomId: room.roomId })
          .sort({ timestamp: -1 })
          .limit(CONSTANTS.MESSAGE_HISTORY_LIMIT)
          .lean();

        if (messages.length > 0) {
          const formattedMessages = messages
            .map((msg) => ({
              id: msg.messageId,
              userId: msg.userId,
              username: msg.username,
              content: msg.content,
              timestamp: msg.timestamp,
              type: msg.type,
              edited: msg.metadata?.edited || false
            }))
            .reverse();

          await this.set(
            `room:${room.roomId}:messages`,
            formattedMessages,
            CONSTANTS.CACHE_TTL.MESSAGE_HISTORY
          );
          count++;
        }
      }

      return count;
    } catch (error) {
      logger.error('Failed to warm messages cache', {
        service: 'cache',
        error: error.message
      });
      return 0;
    }
  }

  trackDependencies(key, dependencies) {
    if (!dependencies || dependencies.length === 0) return;

    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, new Set());
    }

    dependencies.forEach((dep) => {
      this.dependencies.get(key).add(dep);

      if (!this.reverseDependencies.has(dep)) {
        this.reverseDependencies.set(dep, new Set());
      }
      this.reverseDependencies.get(dep).add(key);
    });
  }

  cleanupDependencies(key) {
    const deps = this.dependencies.get(key);
    if (deps) {
      deps.forEach((dep) => {
        const reverseDeps = this.reverseDependencies.get(dep);
        if (reverseDeps) {
          reverseDeps.delete(key);
          if (reverseDeps.size === 0) {
            this.reverseDependencies.delete(dep);
          }
        }
      });
      this.dependencies.delete(key);
    }

    const reverseDeps = this.reverseDependencies.get(key);
    if (reverseDeps) {
      reverseDeps.forEach((reverseKey) => {
        const keyDeps = this.dependencies.get(reverseKey);
        if (keyDeps) {
          keyDeps.delete(key);
          if (keyDeps.size === 0) {
            this.dependencies.delete(reverseKey);
          }
        }
      });
      this.reverseDependencies.delete(key);
    }
  }

  matchPattern(key, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  setupCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.localCache) {
        if (entry.expiresAt <= now) {
          this.localCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug('Cleaned up expired local cache entries', {
          service: 'cache',
          count: cleanedCount
        });
      }
    }, 60000);
  }

  getStats() {
    return {
      ...this.cacheStats,
      localCacheSize: this.localCache.size,
      hitRate:
        this.cacheStats.hits + this.cacheStats.misses > 0
          ? (
            (this.cacheStats.hits /
                (this.cacheStats.hits + this.cacheStats.misses)) *
              100
          ).toFixed(2) + '%'
          : '0%',
      dependenciesTracked: this.dependencies.size
    };
  }

  clear() {
    this.localCache.clear();
    this.dependencies.clear();
    this.reverseDependencies.clear();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      warmups: 0
    };
  }
}

export const cacheManager = new CacheManager();

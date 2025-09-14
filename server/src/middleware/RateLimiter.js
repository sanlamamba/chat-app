import { RateLimiterMemory } from 'rate-limiter-flexible';
import { CONSTANTS } from '../config/constants.js';
import logger from '../utils/logger.js';

export class RateLimiter {
  constructor() {
    this.messageLimiter = new RateLimiterMemory({
      points: CONSTANTS.RATE_LIMIT_MESSAGES.POINTS,
      duration: CONSTANTS.RATE_LIMIT_MESSAGES.DURATION,
      blockDuration: CONSTANTS.RATE_LIMIT_MESSAGES.BLOCK_DURATION
    });

    this.roomLimiter = new RateLimiterMemory({
      points: CONSTANTS.RATE_LIMIT_ROOMS.POINTS,
      duration: CONSTANTS.RATE_LIMIT_ROOMS.DURATION,
      blockDuration: CONSTANTS.RATE_LIMIT_ROOMS.BLOCK_DURATION
    });

    this.connectionLimiter = new RateLimiterMemory({
      points: 10,
      duration: 60,
      blockDuration: 300
    });

    this.commandLimiter = new RateLimiterMemory({
      points: 10,
      duration: 60,
      blockDuration: 60
    });
  }

  async checkLimit(identifier, type) {
    try {
      let limiter;

      switch (type) {
        case CONSTANTS.MESSAGE_TYPES.SEND_MESSAGE:
          limiter = this.messageLimiter;
          break;
        case CONSTANTS.MESSAGE_TYPES.CREATE_ROOM:
          limiter = this.roomLimiter;
          break;
        case CONSTANTS.MESSAGE_TYPES.COMMAND:
          limiter = this.commandLimiter;
          break;
        case 'connection':
          limiter = this.connectionLimiter;
          break;
        default:
          return { allowed: true };
      }

      await limiter.consume(identifier);

      return { allowed: true };
    } catch (rateLimiterRes) {
      logger.warn(`Rate limit exceeded for ${identifier} on ${type}`);

      return {
        allowed: false,
        retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 60,
        remainingPoints: rateLimiterRes.remainingPoints || 0
      };
    }
  }

  async reset(identifier, type) {
    try {
      let limiter;

      switch (type) {
        case CONSTANTS.MESSAGE_TYPES.SEND_MESSAGE:
          limiter = this.messageLimiter;
          break;
        case CONSTANTS.MESSAGE_TYPES.CREATE_ROOM:
          limiter = this.roomLimiter;
          break;
        case CONSTANTS.MESSAGE_TYPES.COMMAND:
          limiter = this.commandLimiter;
          break;
        case 'connection':
          limiter = this.connectionLimiter;
          break;
        default:
          return false;
      }

      await limiter.delete(identifier);
      return true;
    } catch (error) {
      logger.error('Error resetting rate limit:', error);
      return false;
    }
  }
}

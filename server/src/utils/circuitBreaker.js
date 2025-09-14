import logger from '../utils/logger.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.monitoringPeriod = options.monitoringPeriod || 60000;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;

    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0
    };
  }

  async execute(operation, fallback = null) {
    this.metrics.totalRequests++;

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info('Circuit breaker moving to HALF_OPEN state', {
          service: 'circuit-breaker',
          state: this.state
        });
      } else {
        logger.debug('Circuit breaker is OPEN, using fallback', {
          service: 'circuit-breaker',
          state: this.state
        });
        return fallback ? await fallback() : null;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();

      if (fallback) {
        logger.warn('Operation failed, using fallback', {
          service: 'circuit-breaker',
          error: error.message,
          state: this.state
        });
        return await fallback();
      }

      throw error;
    }
  }

  onSuccess() {
    this.metrics.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        logger.info('Circuit breaker moved to CLOSED state', {
          service: 'circuit-breaker',
          state: this.state
        });
      }
    }
  }

  onFailure() {
    this.metrics.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker moved to OPEN state', {
        service: 'circuit-breaker',
        state: this.state,
        failureCount: this.failureCount
      });
    }
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      ...this.metrics,
      healthRatio:
        this.metrics.totalRequests > 0
          ? this.metrics.totalSuccesses / this.metrics.totalRequests
          : 1
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

export const redisCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
  monitoringPeriod: 60000
});

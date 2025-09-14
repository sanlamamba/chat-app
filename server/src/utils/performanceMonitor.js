import logger from '../utils/logger.js';

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byType: {},
        byMinute: {},
        errors: 0,
        totalLatency: 0
      },
      connections: {
        current: 0,
        peak: 0,
        total: 0,
        avgDuration: 0
      },
      rooms: {
        total: 0,
        active: 0,
        peak: 0,
        avgUsers: 0
      },
      messages: {
        total: 0,
        byMinute: {},
        avgSize: 0,
        totalSize: 0
      },
      system: {
        startTime: Date.now(),
        lastUpdate: Date.now()
      }
    };

    this.activeRequests = new Map();
    this.startPeriodicCollection();
  }

  startRequest(requestId, type, userId = null) {
    const start = Date.now();
    this.activeRequests.set(requestId, {
      type,
      userId,
      startTime: start
    });

    this.metrics.requests.total++;
    this.metrics.requests.byType[type] =
      (this.metrics.requests.byType[type] || 0) + 1;

    const minute = Math.floor(start / 60000);
    this.metrics.requests.byMinute[minute] =
      (this.metrics.requests.byMinute[minute] || 0) + 1;
  }

  endRequest(requestId, error = null) {
    const request = this.activeRequests.get(requestId);
    if (!request) return;

    const duration = Date.now() - request.startTime;
    this.metrics.requests.totalLatency += duration;

    if (error) {
      this.metrics.requests.errors++;
      logger.debug('Request completed with error', {
        service: 'performance',
        requestId,
        type: request.type,
        duration,
        error: error.message
      });
    }

    this.activeRequests.delete(requestId);
  }

  recordConnection(action, _connectionId = null) {
    switch (action) {
      case 'connect':
        this.metrics.connections.current++;
        this.metrics.connections.total++;
        if (this.metrics.connections.current > this.metrics.connections.peak) {
          this.metrics.connections.peak = this.metrics.connections.current;
        }
        break;
      case 'disconnect':
        this.metrics.connections.current = Math.max(
          0,
          this.metrics.connections.current - 1
        );
        break;
    }
  }

  recordRoom(action, _roomData = {}) {
    switch (action) {
      case 'create':
        this.metrics.rooms.total++;
        this.metrics.rooms.active++;
        if (this.metrics.rooms.active > this.metrics.rooms.peak) {
          this.metrics.rooms.peak = this.metrics.rooms.active;
        }
        break;
      case 'delete':
        this.metrics.rooms.active = Math.max(0, this.metrics.rooms.active - 1);
        break;
    }
  }

  recordMessage(messageData) {
    this.metrics.messages.total++;

    const size = JSON.stringify(messageData).length;
    this.metrics.messages.totalSize += size;
    this.metrics.messages.avgSize =
      this.metrics.messages.totalSize / this.metrics.messages.total;

    const minute = Math.floor(Date.now() / 60000);
    this.metrics.messages.byMinute[minute] =
      (this.metrics.messages.byMinute[minute] || 0) + 1;
  }

  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.system.startTime;
    const memUsage = process.memoryUsage();

    const avgLatency =
      this.metrics.requests.total > 0
        ? this.metrics.requests.totalLatency / this.metrics.requests.total
        : 0;

    const avgConnectionDuration =
      this.metrics.connections.total > 0
        ? uptime / this.metrics.connections.total
        : 0;

    const oneHourAgo = Math.floor((now - 3600000) / 60000);
    for (const minute in this.metrics.requests.byMinute) {
      if (parseInt(minute, 10) < oneHourAgo) {
        delete this.metrics.requests.byMinute[minute];
      }
    }
    for (const minute in this.metrics.messages.byMinute) {
      if (parseInt(minute, 10) < oneHourAgo) {
        delete this.metrics.messages.byMinute[minute];
      }
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime / 1000),
        human: this.formatUptime(uptime)
      },
      requests: {
        ...this.metrics.requests,
        avgLatency: Math.round(avgLatency),
        activeCount: this.activeRequests.size,
        requestsPerSecond: this.calculateRPS(),
        errorRate:
          this.metrics.requests.total > 0
            ? (
              (this.metrics.requests.errors / this.metrics.requests.total) *
                100
            ).toFixed(2) + '%'
            : '0%'
      },
      connections: {
        ...this.metrics.connections,
        avgDuration: Math.round(avgConnectionDuration)
      },
      rooms: this.metrics.rooms,
      messages: {
        ...this.metrics.messages,
        messagesPerSecond: this.calculateMPS(),
        avgSize: Math.round(this.metrics.messages.avgSize)
      },
      system: {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
        },
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }

  calculateRPS() {
    const now = Math.floor(Date.now() / 60000);
    const lastMinute = this.metrics.requests.byMinute[now] || 0;
    return Math.round(lastMinute / 60);
  }

  calculateMPS() {
    const now = Math.floor(Date.now() / 60000);
    const lastMinute = this.metrics.messages.byMinute[now] || 0;
    return Math.round(lastMinute / 60);
  }

  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  startPeriodicCollection() {
    setInterval(() => {
      const metrics = this.getMetrics();
      logger.info('Performance metrics', {
        service: 'performance',
        metrics: {
          requests: metrics.requests.total,
          activeConnections: metrics.connections.current,
          activeRooms: metrics.rooms.active,
          totalMessages: metrics.messages.total,
          memoryUsed: metrics.system.memory.used,
          uptime: metrics.uptime.human,
          requestsPerSecond: metrics.requests.requestsPerSecond,
          errorRate: metrics.requests.errorRate
        }
      });
    }, 5 * 60 * 1000);
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byType: {},
        byMinute: {},
        errors: 0,
        totalLatency: 0
      },
      connections: {
        current: 0,
        peak: 0,
        total: 0,
        avgDuration: 0
      },
      rooms: {
        total: 0,
        active: 0,
        peak: 0,
        avgUsers: 0
      },
      messages: {
        total: 0,
        byMinute: {},
        avgSize: 0,
        totalSize: 0
      },
      system: {
        startTime: Date.now(),
        lastUpdate: Date.now()
      }
    };
    this.activeRequests.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

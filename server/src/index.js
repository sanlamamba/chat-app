import 'dotenv/config';
import { WebSocketServer } from 'ws';
import http from 'http';
import { connectDatabase } from './config/database.js';
import { connectRedis, RedisHelper } from './config/redis.js';
import { ConnectionHandler } from './handlers/ConnectionHandler.js';
import logger from './utils/logger.js';
import { CONSTANTS } from './config/constants.js';
import { RoomService } from './services/RoomService.js';
import { gracefulShutdown } from './utils/shutdown.js';
import { performanceMonitor } from './utils/performanceMonitor.js';
import { cacheManager } from './utils/cacheManager.js';

class ChatServer {
  constructor() {
    this.server = null;
    this.wss = null;
    this.connectionHandler = null;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      await connectDatabase();
      await connectRedis();

      await RoomService.initialize();

      // Warm cache with commonly accessed data
      await cacheManager.warmCache();

      this.server = http.createServer(this.handleHttpRequest.bind(this));

      this.wss = new WebSocketServer({
        server: this.server,
        maxPayload: CONSTANTS.MAX_MESSAGE_SIZE,
        perMessageDeflate: {
          zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024
          },
          clientNoContextTakeover: true,
          serverNoContextTakeover: true,
          serverMaxWindowBits: 10,
          concurrencyLimit: 10,
          threshold: 1024
        }
      });

      this.connectionHandler = new ConnectionHandler(this.wss);

      this.setupWebSocketHandlers();

      const port = process.env.PORT || 3000;
      this.server.listen(port, () => {
        logger.info('Chat server ready', {
          service: 'server',
          port,
          environment: process.env.NODE_ENV || 'development',
          endpoints: {
            websocket: `ws://localhost:${port}`,
            health: `http://localhost:${port}/health`,
            metrics: `http://localhost:${port}/metrics`
          }
        });
      });

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Server initialization failed', {
        service: 'server',
        error: error.message
      });
      process.exit(1);
    }
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      if (this.isShuttingDown) {
        ws.close(1001, 'Server is shutting down');
        return;
      }

      const clientIp = req.socket.remoteAddress;
      logger.debug('WebSocket connection established', {
        service: 'websocket',
        clientIp,
        action: 'connect'
      });

      this.connectionHandler.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', {
        service: 'websocket',
        error: error.message
      });
    });

    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.debug('Terminating dead connection');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, CONSTANTS.HEARTBEAT_INTERVAL);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  handleHttpRequest(req, res) {
    if (req.url === '/health' && req.method === 'GET') {
      const metrics = performanceMonitor.getMetrics();
      const redisMetrics = RedisHelper.getCircuitBreakerMetrics();

      const health = {
        status: 'healthy',
        uptime: metrics.uptime,
        connections: this.wss.clients.size,
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis:
            redisMetrics.state === 'CLOSED'
              ? 'connected'
              : `degraded (${redisMetrics.state})`
        },
        performance: {
          requestsPerSecond: metrics.requests.requestsPerSecond,
          avgLatency: metrics.requests.avgLatency,
          errorRate: metrics.requests.errorRate,
          memoryUsage: metrics.system.memory.used
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
    } else if (req.url === '/metrics' && req.method === 'GET') {
      const connectionMetrics = this.connectionHandler.getMetrics();
      const performanceMetrics = performanceMonitor.getMetrics();
      const redisMetrics = RedisHelper.getCircuitBreakerMetrics();

      const allMetrics = {
        ...connectionMetrics,
        performance: performanceMetrics,
        redis: redisMetrics,
        cache: cacheManager.getStats(),
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(allMetrics, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info('Graceful shutdown initiated', {
        service: 'server',
        signal,
        action: 'shutdown'
      });

      this.server.close(() => {
        logger.info('HTTP server closed', { service: 'server' });
      });

      this.wss.clients.forEach((ws) => {
        ws.close(1001, 'Server is shutting down');
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await gracefulShutdown();

      logger.info('Graceful shutdown completed', { service: 'server' });
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        service: 'server',
        error: error.message,
        stack: error.stack
      });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        service: 'server',
        reason: reason?.message || reason,
        promise: promise.toString()
      });
      shutdown('unhandledRejection');
    });
  }
}

const chatServer = new ChatServer();
chatServer.initialize().catch((error) => {
  logger.error('Failed to start server', {
    service: 'server',
    error: error.message
  });
  process.exit(1);
});

import "dotenv/config";
import { WebSocketServer } from "ws";
import http from "http";
import { connectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { ConnectionHandler } from "./handlers/ConnectionHandler.js";
import logger from "./utils/logger.js";
import { CONSTANTS } from "./config/constants.js";
import { RoomService } from "./services/RoomService.js";
import { gracefulShutdown } from "./utils/shutdown.js";

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

      this.server = http.createServer(this.handleHttpRequest.bind(this));

      this.wss = new WebSocketServer({
        server: this.server,
        maxPayload: CONSTANTS.MAX_MESSAGE_SIZE,
        perMessageDeflate: {
          zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3,
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024,
          },
          clientNoContextTakeover: true,
          serverNoContextTakeover: true,
          serverMaxWindowBits: 10,
          concurrencyLimit: 10,
          threshold: 1024,
        },
      });

      this.connectionHandler = new ConnectionHandler(this.wss);

      this.setupWebSocketHandlers();

      const port = process.env.PORT || 3000;
      this.server.listen(port, () => {
        logger.info(`🚀 Chat server is running on port ${port}`);
        logger.info(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
        logger.info(`🔗 WebSocket endpoint: ws://localhost:${port}`);
      });

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error("Failed to initialize server:", error);
      process.exit(1);
    }
  }

  setupWebSocketHandlers() {
    this.wss.on("connection", (ws, req) => {
      if (this.isShuttingDown) {
        ws.close(1001, "Server is shutting down");
        return;
      }

      const clientIp = req.socket.remoteAddress;
      logger.info(`New connection from ${clientIp}`);

      this.connectionHandler.handleConnection(ws, req);
    });

    this.wss.on("error", (error) => {
      logger.error("WebSocket server error:", error);
    });

    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.debug("Terminating dead connection");
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, CONSTANTS.HEARTBEAT_INTERVAL);

    this.wss.on("close", () => {
      clearInterval(interval);
    });
  }

  handleHttpRequest(req, res) {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          uptime: process.uptime(),
          connections: this.wss.clients.size,
          timestamp: new Date().toISOString(),
        })
      );
    } else if (req.url === "/metrics" && req.method === "GET") {
      const metrics = this.connectionHandler.getMetrics();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`Received ${signal}, starting graceful shutdown...`);

      this.server.close(() => {
        logger.info("HTTP server closed");
      });

      this.wss.clients.forEach((ws) => {
        ws.close(1001, "Server is shutting down");
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await gracefulShutdown();

      logger.info("Graceful shutdown completed");
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      shutdown("unhandledRejection");
    });
  }
}

const chatServer = new ChatServer();
chatServer.initialize().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});

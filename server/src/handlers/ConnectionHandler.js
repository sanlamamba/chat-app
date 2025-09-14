import { MessageHandler } from "./MessageHandler.js";
import { RoomHandler } from "./RoomHandler.js";
import { CommandHandler } from "./CommandHandler.js";
import { UserService } from "../services/UserService.js";
import { RateLimiter } from "../middleware/RateLimiter.js";
import { CONSTANTS } from "../config/constants.js";
import logger from "../utils/logger.js";
import { getRedisSubClient } from "../config/redis.js";

export class ConnectionHandler {
  constructor(wss) {
    this.wss = wss;
    this.connections = new Map(); // ws -> connection info
    this.messageHandler = new MessageHandler();
    this.roomHandler = new RoomHandler();
    this.commandHandler = new CommandHandler();
    this.rateLimiter = new RateLimiter();

    this.setupRedisSubscriptions();
  }

  handleConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const clientIp = req.socket.remoteAddress;

    const connectionInfo = {
      id: connectionId,
      ws,
      ip: clientIp,
      authenticated: false,
      userId: null,
      username: null,
      currentRoom: null,
      joinedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(ws, connectionInfo);

    this.setupWebSocketHandlers(ws, connectionInfo);

    this.sendMessage(ws, {
      type: CONSTANTS.MESSAGE_TYPES.SYSTEM,
      message: "Welcome to the chat server! Please authenticate.",
      timestamp: new Date().toISOString(),
    });

    logger.debug(`New connection established: ${connectionId}`);
  }

  setupWebSocketHandlers(ws, connectionInfo) {
    ws.on("message", async (data) => {
      try {
        connectionInfo.lastActivity = new Date();

        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (e) {
          return this.sendError(ws, "Invalid message format");
        }

        const rateLimitResult = await this.rateLimiter.checkLimit(
          connectionInfo.ip,
          message.type
        );

        if (!rateLimitResult.allowed) {
          return this.sendError(
            ws,
            "Rate limit exceeded",
            CONSTANTS.ERROR_CODES.RATE_LIMIT
          );
        }

        await this.routeMessage(ws, connectionInfo, message);
      } catch (error) {
        logger.error("Error handling message:", error);
        this.sendError(ws, "Internal server error");
      }
    });

    ws.on("close", (code, reason) => {
      this.handleDisconnection(ws, connectionInfo, code, reason);
    });

    ws.on("error", (error) => {
      logger.error(
        `WebSocket error for connection ${connectionInfo.id}:`,
        error
      );
    });

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.isAlive = true;
  }

  async routeMessage(ws, connectionInfo, message) {
    const { type } = message;

    if (
      type !== CONSTANTS.MESSAGE_TYPES.AUTH &&
      !connectionInfo.authenticated
    ) {
      return this.sendError(
        ws,
        "Authentication required",
        CONSTANTS.ERROR_CODES.UNAUTHORIZED
      );
    }

    switch (type) {
      case CONSTANTS.MESSAGE_TYPES.AUTH:
        await this.handleAuth(ws, connectionInfo, message);
        break;

      case CONSTANTS.MESSAGE_TYPES.CREATE_ROOM:
        await this.roomHandler.handleCreateRoom(ws, connectionInfo, message);
        break;

      case CONSTANTS.MESSAGE_TYPES.JOIN_ROOM:
        await this.roomHandler.handleJoinRoom(ws, connectionInfo, message);
        break;

      case CONSTANTS.MESSAGE_TYPES.LEAVE_ROOM:
        await this.roomHandler.handleLeaveRoom(ws, connectionInfo, message);
        break;

      case CONSTANTS.MESSAGE_TYPES.SEND_MESSAGE:
        await this.messageHandler.handleSendMessage(
          ws,
          connectionInfo,
          message
        );
        break;

      case CONSTANTS.MESSAGE_TYPES.TYPING_START:
        await this.messageHandler.handleTypingIndicator(
          ws,
          connectionInfo,
          true
        );
        break;

      case CONSTANTS.MESSAGE_TYPES.TYPING_STOP:
        await this.messageHandler.handleTypingIndicator(
          ws,
          connectionInfo,
          false
        );
        break;

      case CONSTANTS.MESSAGE_TYPES.COMMAND:
        await this.commandHandler.handleCommand(ws, connectionInfo, message);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  async handleAuth(ws, connectionInfo, message) {
    const { username } = message;

    if (!username) {
      return this.sendError(ws, "Username is required");
    }

    const result = await UserService.authenticateUser(
      username,
      connectionInfo.id
    );

    if (!result.success) {
      return this.sendError(ws, result.error);
    }

    connectionInfo.authenticated = true;
    connectionInfo.userId = result.user.userId;
    connectionInfo.username = result.user.username;

    this.sendMessage(ws, {
      type: CONSTANTS.MESSAGE_TYPES.AUTH_SUCCESS,
      user: {
        userId: result.user.userId,
        username: result.user.username,
      },
      timestamp: new Date().toISOString(),
    });

    logger.info(`User authenticated: ${username} (${result.user.userId})`);
  }

  async handleDisconnection(ws, connectionInfo, code, reason) {
    try {
      logger.info(
        `Connection closed: ${connectionInfo.id} (code: ${code}, reason: ${
          reason || "none"
        })`
      );

      if (connectionInfo.authenticated) {
        if (connectionInfo.currentRoom) {
          await this.roomHandler.leaveRoom(connectionInfo);
        }

        await UserService.disconnectUser(connectionInfo.id);
      }

      this.connections.delete(ws);
    } catch (error) {
      logger.error("Error handling disconnection:", error);
    }
  }

  setupRedisSubscriptions() {
    const subClient = getRedisSubClient();
    if (!subClient) return;

    subClient.subscribe("global:broadcast");

    subClient.on("message", (channel, message) => {
      try {
        const data = JSON.parse(message);

        if (channel === "global:broadcast") {
          this.broadcastToAll(data);
        }
      } catch (error) {
        logger.error("Error handling Redis message:", error);
      }
    });
  }

  sendMessage(ws, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  sendError(ws, message, code = CONSTANTS.ERROR_CODES.INVALID_MESSAGE) {
    this.sendMessage(ws, {
      type: CONSTANTS.MESSAGE_TYPES.ERROR,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToAll(data) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  broadcastToRoom(roomId, data, excludeWs = null) {
    this.connections.forEach((info, ws) => {
      if (
        info.currentRoom === roomId &&
        ws !== excludeWs &&
        ws.readyState === ws.OPEN
      ) {
        ws.send(JSON.stringify(data));
      }
    });
  }

  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getMetrics() {
    const activeConnections = this.connections.size;
    const authenticatedConnections = Array.from(
      this.connections.values()
    ).filter((c) => c.authenticated).length;
    const roomDistribution = {};

    this.connections.forEach((info) => {
      if (info.currentRoom) {
        roomDistribution[info.currentRoom] =
          (roomDistribution[info.currentRoom] || 0) + 1;
      }
    });

    return {
      connections: {
        total: activeConnections,
        authenticated: authenticatedConnections,
        unauthenticated: activeConnections - authenticatedConnections,
      },
      rooms: roomDistribution,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}

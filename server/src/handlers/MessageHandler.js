import { MessageService } from '../services/MessageService.js';
import { RoomService } from '../services/RoomService.js';
import { CONSTANTS } from '../config/constants.js';
import logger from '../utils/logger.js';
import { getRedisSubClient } from '../config/redis.js';

export class MessageHandler {
  constructor() {
    this.setupSubscriptions();
  }

  async handleSendMessage(ws, connectionInfo, message) {
    try {
      const { content } = message;

      if (!connectionInfo.currentRoom) {
        return this.sendError(ws, 'You must join a room first');
      }

      if (!content || typeof content !== 'string') {
        return this.sendError(ws, 'Message content is required');
      }

      if (content.length > CONSTANTS.MAX_MESSAGE_LENGTH) {
        return this.sendError(
          ws,
          `Message too long (max ${CONSTANTS.MAX_MESSAGE_LENGTH} characters)`
        );
      }

      const result = await MessageService.sendMessage(
        connectionInfo.currentRoom,
        connectionInfo.userId,
        connectionInfo.username,
        content
      );

      if (!result.success) {
        return this.sendError(ws, result.error);
      }

      this.broadcastToRoom(connectionInfo.currentRoom, {
        type: CONSTANTS.MESSAGE_TYPES.MESSAGE,
        message: result.message,
        timestamp: new Date().toISOString()
      });

      await RoomService.handleTypingIndicator(
        connectionInfo.currentRoom,
        connectionInfo.userId,
        false
      );
    } catch (error) {
      logger.error('Error handling send message:', error);
      this.sendError(ws, 'Failed to send message');
    }
  }

  async handleTypingIndicator(ws, connectionInfo, isTyping) {
    try {
      if (!connectionInfo.currentRoom) {
        return;
      }

      const typingUsers = await RoomService.handleTypingIndicator(
        connectionInfo.currentRoom,
        connectionInfo.userId,
        isTyping
      );

      this.broadcastToRoom(
        connectionInfo.currentRoom,
        {
          type: CONSTANTS.MESSAGE_TYPES.TYPING_UPDATE,
          typingUsers,
          timestamp: new Date().toISOString()
        },
        ws
      );
    } catch (error) {
      logger.error('Error handling typing indicator:', error);
    }
  }

  setupSubscriptions() {
    const subClient = getRedisSubClient();
    if (!subClient) return;
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
        message
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcastToRoom(roomId, data, excludeWs = null) {
    if (this.connectionHandler) {
      this.connectionHandler.broadcastToRoom(roomId, data, excludeWs);
    }
  }

  setConnectionHandler(handler) {
    this.connectionHandler = handler;
  }
}

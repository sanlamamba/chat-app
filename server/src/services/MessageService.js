import { v4 as uuidv4 } from 'uuid';
import { Message } from '../models/Message.js';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';
import { RoomMembership } from '../models/RoomMembership.js';
import { RedisHelper, getRedisPubClient } from '../config/redis.js';
import { CONSTANTS } from '../config/constants.js';
import logger from '../utils/logger.js';
import validator from '../utils/validator.js';
import { cacheManager } from '../utils/cacheManager.js';

class MessageServiceClass {
  constructor() {
    this.messageQueue = [];
    this.processing = false;
  }

  async sendMessage(roomId, userId, username, content) {
    try {
      const validation = validator.validateMessage(content);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const sanitizedContent = validator.sanitizeContent(content);

      const messageId = uuidv4();
      const timestamp = new Date();

      const messageData = {
        messageId,
        roomId,
        userId,
        username,
        content: sanitizedContent,
        timestamp,
        type: 'message'
      };

      const savedMessage = await Message.createMessage(messageData);

      await Room.findOneAndUpdate(
        { roomId },
        {
          $inc: { 'metadata.messageCount': 1 },
          lastActivity: timestamp
        }
      );

      await User.findOneAndUpdate(
        { userId },
        {
          $inc: { 'metadata.totalMessages': 1 },
          lastSeen: timestamp
        }
      );

      await RoomMembership.findOneAndUpdate(
        { roomId, userId, isActive: true },
        {
          $inc: { 'metadata.messagesInRoom': 1 },
          'metadata.lastMessageAt': timestamp
        }
      );

      await cacheManager.invalidate(`room:${roomId}:messages`);

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${roomId}:messages`,
          JSON.stringify(savedMessage)
        );
      }

      logger.debug(`Message sent in room ${roomId} by ${username}`);

      return {
        success: true,
        message: savedMessage
      };
    } catch (error) {
      logger.error('Error sending message:', error);
      return {
        success: false,
        error: 'Failed to send message'
      };
    }
  }

  async getMessageHistory(roomId, limit = CONSTANTS.MESSAGE_HISTORY_LIMIT) {
    try {
      const cacheKey = `room:${roomId}:messages`;
      const cached = await cacheManager.get(cacheKey, async () => {
        const messages = await Message.getRoomHistory(roomId, limit);

        const formattedMessages = messages.map((msg) => ({
          id: msg.messageId,
          userId: msg.userId,
          username: msg.username,
          content: msg.content,
          timestamp: msg.timestamp,
          type: msg.type,
          edited: msg.metadata?.edited || false
        }));

        return formattedMessages.reverse();
      });

      return cached || [];
    } catch (error) {
      logger.error('Error getting message history:', error);
      return [];
    }
  }

  async broadcastSystemMessage(roomId, content, type = 'system') {
    try {
      const messageId = uuidv4();
      const timestamp = new Date();

      const systemMessage = {
        messageId,
        roomId,
        userId: 'system',
        username: 'System',
        content,
        timestamp,
        type
      };

      if (type === 'notification') {
        await Message.create(systemMessage);
      }

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${roomId}:messages`,
          JSON.stringify(systemMessage)
        );
      }

      return systemMessage;
    } catch (error) {
      logger.error('Error broadcasting system message:', error);
      return null;
    }
  }

  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findOne({ messageId });

      if (!message) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      if (message.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      message.content = '[Message deleted]';
      message.metadata.edited = true;
      message.metadata.editedAt = new Date();
      await message.save();

      await RedisHelper.delete(`room:${message.roomId}:messages`);

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${message.roomId}:events`,
          JSON.stringify({
            type: 'message_deleted',
            messageId,
            roomId: message.roomId
          })
        );
      }

      return {
        success: true
      };
    } catch (error) {
      logger.error('Error deleting message:', error);
      return {
        success: false,
        error: 'Failed to delete message'
      };
    }
  }

  async editMessage(messageId, userId, newContent) {
    try {
      const validation = validator.validateMessage(newContent);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const message = await Message.findOne({ messageId });

      if (!message) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      if (message.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (message.timestamp < fiveMinutesAgo) {
        return {
          success: false,
          error: 'Message is too old to edit'
        };
      }

      const sanitizedContent = validator.sanitizeContent(newContent);
      await message.editContent(sanitizedContent);

      await RedisHelper.delete(`room:${message.roomId}:messages`);

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${message.roomId}:events`,
          JSON.stringify({
            type: 'message_edited',
            messageId,
            roomId: message.roomId,
            newContent: sanitizedContent
          })
        );
      }

      return {
        success: true,
        message: message.format()
      };
    } catch (error) {
      logger.error('Error editing message:', error);
      return {
        success: false,
        error: 'Failed to edit message'
      };
    }
  }

  async getUserRecentMessages(userId, limit = 50) {
    try {
      const messages = await Message.getUserMessages(userId, limit);

      return messages.map((msg) => ({
        id: msg.messageId,
        roomId: msg.roomId,
        content: msg.content,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      logger.error('Error getting user messages:', error);
      return [];
    }
  }

  async getMessageStats(roomId, hours = 24) {
    try {
      const stats = await Message.getMessageStats(roomId, hours);
      return stats;
    } catch (error) {
      logger.error('Error getting message stats:', error);
      return [];
    }
  }

  async cleanup() {
    try {
      const result = await Message.deleteOldMessages();
      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old messages`);
      }
    } catch (error) {
      logger.error('Error during message cleanup:', error);
    }
  }
}

export const MessageService = new MessageServiceClass();

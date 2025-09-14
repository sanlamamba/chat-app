import { v4 as uuidv4 } from "uuid";
import { User } from "../models/User.js";
import { RoomMembership } from "../models/RoomMembership.js";
import { RedisHelper } from "../config/redis.js";
import { CONSTANTS } from "../config/constants.js";
import logger from "../utils/logger.js";
import validator from "../utils/validator.js";

class UserServiceClass {
  constructor() {
    this.activeConnections = new Map();
    this.userSockets = new Map();
  }

  async authenticateUser(username, socketId) {
    try {
      const validation = validator.validateUsername(username);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const userId = uuidv4();

      const existingUser = await User.findOne({
        username,
        isOnline: true,
      });

      if (existingUser) {
        return await this.handleExistingUser(existingUser, socketId);
      }

      const user = await User.create({
        userId,
        username,
        isOnline: true,
        metadata: {
          connectionCount: 1,
        },
      });

      await RedisHelper.setWithTTL(
        `user:${userId}:info`,
        {
          userId,
          username,
          socketId,
          connectedAt: new Date().toISOString(),
        },
        CONSTANTS.CACHE_TTL.USER_INFO
      );

      this.activeConnections.set(socketId, userId);
      this.userSockets.set(userId, new Set([socketId]));

      logger.info(`User authenticated: ${username} (${userId})`);

      return {
        success: true,
        user: {
          userId,
          username,
          isNew: true,
        },
      };
    } catch (error) {
      logger.error("Error authenticating user:", error);
      return {
        success: false,
        error: "Authentication failed",
      };
    }
  }

  async handleExistingUser(user, socketId) {
    try {
      user.isOnline = true;
      user.lastSeen = new Date();
      user.metadata.connectionCount++;
      await user.save();

      this.activeConnections.set(socketId, user.userId);

      if (!this.userSockets.has(user.userId)) {
        this.userSockets.set(user.userId, new Set());
      }
      this.userSockets.get(user.userId).add(socketId);

      await RedisHelper.setWithTTL(
        `user:${user.userId}:info`,
        {
          userId: user.userId,
          username: user.username,
          socketId,
          connectedAt: new Date().toISOString(),
        },
        CONSTANTS.CACHE_TTL.USER_INFO
      );

      logger.info(
        `Existing user reconnected: ${user.username} (${user.userId})`
      );

      return {
        success: true,
        user: {
          userId: user.userId,
          username: user.username,
          isNew: false,
        },
      };
    } catch (error) {
      logger.error("Error handling existing user:", error);
      return {
        success: false,
        error: "Failed to reconnect user",
      };
    }
  }

  async disconnectUser(socketId) {
    try {
      const userId = this.activeConnections.get(socketId);

      if (!userId) {
        return { success: true };
      }

      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);

        if (userSockets.size === 0) {
          await this.markUserOffline(userId);
          this.userSockets.delete(userId);
        }
      }

      this.activeConnections.delete(socketId);

      return { success: true };
    } catch (error) {
      logger.error("Error disconnecting user:", error);
      return {
        success: false,
        error: "Failed to disconnect user",
      };
    }
  }

  async markUserOffline(userId) {
    try {
      const user = await User.setUserOnline(userId, false);

      if (!user) {
        return;
      }

      const memberships = await RoomMembership.find({
        userId,
        isActive: true,
      });

      for (const membership of memberships) {
        await RoomMembership.leaveRoom(userId, membership.roomId);
      }

      await RedisHelper.delete(`user:${userId}:info`);

      logger.info(`User marked offline: ${user.username} (${userId})`);
    } catch (error) {
      logger.error("Error marking user offline:", error);
    }
  }

  async getUserInfo(userId) {
    try {
      const cached = await RedisHelper.get(`user:${userId}:info`);
      if (cached) return cached;

      const user = await User.findByUserId(userId);
      if (!user) return null;

      const info = {
        userId: user.userId,
        username: user.username,
        isOnline: user.isOnline,
        currentRoom: user.currentRoom,
        lastSeen: user.lastSeen,
        totalMessages: user.metadata.totalMessages,
      };

      await RedisHelper.setWithTTL(
        `user:${userId}:info`,
        info,
        CONSTANTS.CACHE_TTL.USER_INFO
      );

      return info;
    } catch (error) {
      logger.error("Error getting user info:", error);
      return null;
    }
  }

  async getOnlineUsers() {
    try {
      const users = await User.findOnlineUsers();

      return users.map((user) => ({
        userId: user.userId,
        username: user.username,
        currentRoom: user.currentRoom,
      }));
    } catch (error) {
      logger.error("Error getting online users:", error);
      return [];
    }
  }

  async getUsersInRoom(roomName) {
    try {
      const users = await User.findUsersInRoom(roomName);

      return users.map((user) => ({
        userId: user.userId,
        username: user.username,
      }));
    } catch (error) {
      logger.error("Error getting users in room:", error);
      return [];
    }
  }

  async updateUserActivity(userId) {
    try {
      await User.findOneAndUpdate({ userId }, { lastSeen: new Date() });
    } catch (error) {
      logger.error("Error updating user activity:", error);
    }
  }

  getUserIdBySocket(socketId) {
    return this.activeConnections.get(socketId);
  }

  getSocketsByUserId(userId) {
    return Array.from(this.userSockets.get(userId) || []);
  }

  getMetrics() {
    return {
      activeConnections: this.activeConnections.size,
      uniqueUsers: this.userSockets.size,
      multiDeviceUsers: Array.from(this.userSockets.entries()).filter(
        ([_, sockets]) => sockets.size > 1
      ).length,
    };
  }

  async cleanup() {
    try {
      const result = await User.cleanupInactiveUsers();
      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} inactive users`);
      }
    } catch (error) {
      logger.error("Error during user cleanup:", error);
    }
  }
}

export const UserService = new UserServiceClass();

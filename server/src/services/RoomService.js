import { v4 as uuidv4 } from "uuid";
import { Room } from "../models/Room.js";
import { RoomMembership } from "../models/RoomMembership.js";
import { User } from "../models/User.js";
import { RedisHelper, getRedisPubClient } from "../config/redis.js";
import { CONSTANTS } from "../config/constants.js";
import logger from "../utils/logger.js";
import { Mutex } from "async-mutex";

class RoomServiceClass {
  constructor() {
    this.roomCreationMutex = new Mutex();
    this.localRoomCache = new Map();
  }

  async initialize() {
    const startTime = Date.now();

    try {
      const activeRooms = await Room.findActiveRooms(100);
      activeRooms.forEach((room) => {
        this.localRoomCache.set(room.name, room.roomId);
      });

      const duration = Date.now() - startTime;
      logger.info("Room service initialized", {
        service: "room",
        roomsLoaded: activeRooms.length,
        duration,
        action: "cache_init",
      });
    } catch (error) {
      logger.error("Failed to initialize room cache", {
        service: "room",
        error: error.message,
        duration: Date.now() - startTime,
        action: "cache_init",
      });
    }
  }

  async createRoom(roomName, userId, username) {
    const release = await this.roomCreationMutex.acquire();

    try {
      if (!CONSTANTS.REGEX.ROOM_NAME.test(roomName)) {
        return {
          success: false,
          error: "Invalid room name format",
        };
      }

      if (this.localRoomCache.has(roomName)) {
        return {
          success: false,
          error: "Room already exists",
        };
      }

      const existingRoom = await Room.findByName(roomName);
      if (existingRoom) {
        this.localRoomCache.set(roomName, existingRoom.roomId);
        return {
          success: false,
          error: "Room already exists",
        };
      }

      const roomId = uuidv4();
      const result = await Room.createRoom({
        roomId,
        name: roomName,
        createdBy: userId,
        metadata: {
          currentUsers: 0,
        },
      });

      if (!result.success) {
        return result;
      }

      this.localRoomCache.set(roomName, roomId);

      await RedisHelper.setWithTTL(
        `room:${roomId}:info`,
        {
          id: roomId,
          name: roomName,
          createdBy: userId,
          createdAt: new Date().toISOString(),
        },
        CONSTANTS.CACHE_TTL.ROOM_INFO
      );

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          "room:created",
          JSON.stringify({
            roomId,
            roomName,
            createdBy: username,
          })
        );
      }

      logger.info(`Room created: ${roomName} (${roomId}) by ${username}`);

      return {
        success: true,
        room: result.room,
      };
    } catch (error) {
      logger.error("Error creating room", {
        service: "room",
        roomName,
        userId,
        error: error.message,
        action: "create_room",
      });
      return {
        success: false,
        error: "Failed to create room",
      };
    } finally {
      release();
    }
  }

  async joinRoom(roomId, userId, username) {
    try {
      const room = await Room.findOne({ roomId, isActive: true });
      if (!room) {
        return {
          success: false,
          error: "Room not found",
        };
      }

      await RoomMembership.joinRoom(userId, username, roomId);

      await User.updateUserRoom(userId, room.name);

      await Room.incrementUserCount(roomId, 1);

      await RedisHelper.addToSet(`room:${roomId}:members`, userId);

      const members = await this.getRoomMembers(roomId);

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${roomId}:events`,
          JSON.stringify({
            type: "user_joined",
            userId,
            username,
            roomId,
            memberCount: members.length,
          })
        );
      }

      logger.info(`User ${username} joined room ${room.name}`);

      return {
        success: true,
        room: {
          id: roomId,
          name: room.name,
          memberCount: members.length,
        },
      };
    } catch (error) {
      logger.error("Error joining room:", error);
      return {
        success: false,
        error: "Failed to join room",
      };
    }
  }

  async leaveRoom(roomId, userId, username) {
    try {
      await RoomMembership.leaveRoom(userId, roomId);

      await User.updateUserRoom(userId, null);

      const room = await Room.incrementUserCount(roomId, -1);

      await RedisHelper.removeFromSet(`room:${roomId}:members`, userId);

      await RedisHelper.removeFromSet(`room:${roomId}:typing`, userId);

      const members = await this.getRoomMembers(roomId);

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${roomId}:events`,
          JSON.stringify({
            type: "user_left",
            userId,
            username,
            roomId,
            memberCount: members.length,
          })
        );
      }

      logger.info(`User ${username} left room ${room?.name || roomId}`);

      if (room && room.metadata.currentUsers === 0) {
        await this.handleEmptyRoom(roomId, room.name);
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.error("Error leaving room:", error);
      return {
        success: false,
        error: "Failed to leave room",
      };
    }
  }

  async handleEmptyRoom(roomId, roomName) {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { isActive: false, "metadata.currentUsers": 0 }
      );

      this.localRoomCache.delete(roomName);

      await RedisHelper.delete(`room:${roomId}:info`);
      await RedisHelper.delete(`room:${roomId}:members`);
      await RedisHelper.delete(`room:${roomId}:typing`);

      logger.info(`Room ${roomName} marked as inactive (no users)`);
    } catch (error) {
      logger.error("Error handling empty room:", error);
    }
  }

  async getRoomMembers(roomId) {
    try {
      const redisMembers = await RedisHelper.getSetMembers(
        `room:${roomId}:members`
      );

      if (redisMembers && redisMembers.length > 0) {
        const users = await User.find({
          userId: { $in: redisMembers },
          isOnline: true,
        }).select("userId username");

        return users.map((u) => ({
          userId: u.userId,
          username: u.username,
        }));
      }

      const memberships = await RoomMembership.getActiveRoomMembers(roomId);

      return memberships.map((m) => ({
        userId: m.userId,
        username: m.username,
      }));
    } catch (error) {
      logger.error("Error getting room members:", error);
      return [];
    }
  }

  async getRoomList(limit = 20) {
    try {
      const rooms = await Room.findActiveRooms(limit);

      return rooms.map((room) => ({
        id: room.roomId,
        name: room.name,
        userCount: room.metadata.currentUsers,
        messageCount: room.metadata.messageCount,
        createdAt: room.createdAt,
      }));
    } catch (error) {
      logger.error("Error getting room list:", error);
      return [];
    }
  }

  async getRoomInfo(roomId) {
    try {
      const cached = await RedisHelper.get(`room:${roomId}:info`);
      if (cached) return cached;

      const room = await Room.findOne({ roomId });
      if (!room) return null;

      const info = {
        id: room.roomId,
        name: room.name,
        userCount: room.metadata.currentUsers,
        messageCount: room.metadata.messageCount,
        createdAt: room.createdAt,
        isActive: room.isActive,
      };

      await RedisHelper.setWithTTL(
        `room:${roomId}:info`,
        info,
        CONSTANTS.CACHE_TTL.ROOM_INFO
      );

      return info;
    } catch (error) {
      logger.error("Error getting room info:", error);
      return null;
    }
  }

  async handleTypingIndicator(roomId, userId, isTyping) {
    try {
      const key = `room:${roomId}:typing`;

      if (isTyping) {
        await RedisHelper.addToSet(key, userId);
        const redisClient = await import("../config/redis.js").then((m) =>
          m.getRedisClient()
        );
        if (redisClient) {
          await redisClient.expire(key, CONSTANTS.TYPING_INDICATOR_TTL);
        }
      } else {
        await RedisHelper.removeFromSet(key, userId);
      }

      const typingUsers = await RedisHelper.getSetMembers(key);

      const users = await User.find({
        userId: { $in: typingUsers },
      }).select("username");

      const typingUsernames = users.map((u) => u.username);

      const pubClient = getRedisPubClient();
      if (pubClient) {
        await pubClient.publish(
          `room:${roomId}:events`,
          JSON.stringify({
            type: "typing_update",
            roomId,
            typingUsers: typingUsernames,
          })
        );
      }

      return typingUsernames;
    } catch (error) {
      logger.error("Error handling typing indicator:", error);
      return [];
    }
  }

  async cleanup() {
    try {
      const result = await Room.cleanupEmptyRooms();
      if (result.modifiedCount > 0) {
        logger.info(`Cleaned up ${result.modifiedCount} empty rooms`);
      }

      const membershipResult =
        await RoomMembership.cleanupInactiveMemberships();
      if (membershipResult.deletedCount > 0) {
        logger.info(
          `Cleaned up ${membershipResult.deletedCount} inactive memberships`
        );
      }

      await this.initialize();
    } catch (error) {
      logger.error("Error during room cleanup:", error);
    }
  }
}

export const RoomService = new RoomServiceClass();

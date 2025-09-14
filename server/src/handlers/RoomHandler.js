import { RoomService } from "../services/RoomService.js";
import { MessageService } from "../services/MessageService.js";
import { CONSTANTS } from "../config/constants.js";
import logger from "../utils/logger.js";
import { getRedisSubClient } from "../config/redis.js";

export class RoomHandler {
  constructor() {
    this.roomSubscriptions = new Map(); // roomId -> subscription info
  }

  async handleCreateRoom(ws, connectionInfo, message) {
    try {
      const { roomName } = message;

      if (!roomName) {
        return this.sendError(ws, "Room name is required");
      }

      const result = await RoomService.createRoom(
        roomName,
        connectionInfo.userId,
        connectionInfo.username
      );

      if (!result.success) {
        return this.sendError(ws, result.error);
      }

      await this.joinRoom(
        ws,
        connectionInfo,
        result.room.roomId,
        result.room.name
      );

      this.sendMessage(ws, {
        type: CONSTANTS.MESSAGE_TYPES.ROOM_CREATED,
        room: {
          id: result.room.roomId,
          name: result.room.name,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info(`Room created: ${roomName} by ${connectionInfo.username}`);
    } catch (error) {
      logger.error("Error creating room:", error);
      this.sendError(ws, "Failed to create room");
    }
  }

  async handleJoinRoom(ws, connectionInfo, message) {
    try {
      const { roomName } = message;

      if (!roomName) {
        return this.sendError(ws, "Room name is required");
      }

      const { Room } = await import("../models/Room.js");
      const room = await Room.findByName(roomName);

      if (!room) {
        return this.sendError(
          ws,
          "Room not found",
          CONSTANTS.ERROR_CODES.ROOM_NOT_FOUND
        );
      }

      if (connectionInfo.currentRoom) {
        await this.leaveRoom(connectionInfo);
      }

      await this.joinRoom(ws, connectionInfo, room.roomId, room.name);
    } catch (error) {
      logger.error("Error joining room:", error);
      this.sendError(ws, "Failed to join room");
    }
  }

  async handleLeaveRoom(ws, connectionInfo, message) {
    try {
      if (!connectionInfo.currentRoom) {
        return this.sendError(ws, "You are not in a room");
      }

      const roomName = connectionInfo.currentRoomName;
      await this.leaveRoom(connectionInfo);

      this.sendMessage(ws, {
        type: CONSTANTS.MESSAGE_TYPES.ROOM_LEFT,
        roomName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error leaving room:", error);
      this.sendError(ws, "Failed to leave room");
    }
  }

  async joinRoom(ws, connectionInfo, roomId, roomName) {
    const result = await RoomService.joinRoom(
      roomId,
      connectionInfo.userId,
      connectionInfo.username
    );

    if (!result.success) {
      return this.sendError(ws, result.error);
    }

    connectionInfo.currentRoom = roomId;
    connectionInfo.currentRoomName = roomName;

    this.subscribeToRoom(roomId);

    const members = await RoomService.getRoomMembers(roomId);

    const history = await MessageService.getMessageHistory(roomId);

    this.sendMessage(ws, {
      type: CONSTANTS.MESSAGE_TYPES.ROOM_JOINED,
      room: {
        id: roomId,
        name: roomName,
        memberCount: members.length,
      },
      members: members.map((m) => m.username),
      timestamp: new Date().toISOString(),
    });

    if (history.length > 0) {
      this.sendMessage(ws, {
        type: CONSTANTS.MESSAGE_TYPES.MESSAGE_HISTORY,
        messages: history,
        timestamp: new Date().toISOString(),
      });
    }

    await MessageService.broadcastSystemMessage(
      roomId,
      `${connectionInfo.username} a rejoint la salle`,
      "notification"
    );

    this.broadcastToRoom(
      roomId,
      {
        type: CONSTANTS.MESSAGE_TYPES.USER_JOINED,
        user: {
          userId: connectionInfo.userId,
          username: connectionInfo.username,
        },
        memberCount: members.length,
        timestamp: new Date().toISOString(),
      },
      ws
    );
  }

  async leaveRoom(connectionInfo) {
    const roomId = connectionInfo.currentRoom;
    const roomName = connectionInfo.currentRoomName;

    if (!roomId) return;

    await RoomService.leaveRoom(
      roomId,
      connectionInfo.userId,
      connectionInfo.username
    );

    const members = await RoomService.getRoomMembers(roomId);

    await MessageService.broadcastSystemMessage(
      roomId,
      `${connectionInfo.username} a quitté la salle`,
      "notification"
    );

    this.broadcastToRoom(roomId, {
      type: CONSTANTS.MESSAGE_TYPES.USER_LEFT,
      user: {
        userId: connectionInfo.userId,
        username: connectionInfo.username,
      },
      memberCount: members.length,
      timestamp: new Date().toISOString(),
    });

    connectionInfo.currentRoom = null;
    connectionInfo.currentRoomName = null;

    if (members.length === 0) {
      this.unsubscribeFromRoom(roomId);
    }
  }

  subscribeToRoom(roomId) {
    if (this.roomSubscriptions.has(roomId)) {
      return;
    }

    const subClient = getRedisSubClient();
    if (!subClient) return;

    const channels = [`room:${roomId}:messages`, `room:${roomId}:events`];

    channels.forEach((channel) => {
      subClient.subscribe(channel);
    });

    this.roomSubscriptions.set(roomId, { channels });

    logger.debug(`Subscribed to room ${roomId} channels`);
  }

  unsubscribeFromRoom(roomId) {
    const subscription = this.roomSubscriptions.get(roomId);
    if (!subscription) return;

    const subClient = getRedisSubClient();
    if (!subClient) return;

    subscription.channels.forEach((channel) => {
      subClient.unsubscribe(channel);
    });

    this.roomSubscriptions.delete(roomId);

    logger.debug(`Unsubscribed from room ${roomId} channels`);
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

  broadcastToRoom(roomId, data, excludeWs = null) {
    if (this.connectionHandler) {
      this.connectionHandler.broadcastToRoom(roomId, data, excludeWs);
    }
  }

  setConnectionHandler(handler) {
    this.connectionHandler = handler;
  }
}

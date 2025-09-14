import { RoomService } from "../services/RoomService.js";
import { UserService } from "../services/UserService.js";
import { CONSTANTS } from "../config/constants.js";
import logger from "../utils/logger.js";

export class CommandHandler {
  constructor() {
    this.commands = {
      rooms: this.handleRoomsCommand.bind(this),
      users: this.handleUsersCommand.bind(this),
      help: this.handleHelpCommand.bind(this),
      stats: this.handleStatsCommand.bind(this),
      me: this.handleMeCommand.bind(this),
      clear: this.handleClearCommand.bind(this),
    };
  }

  async handleCommand(ws, connectionInfo, message) {
    try {
      const { command, args } = message;

      let cmd, cmdArgs;
      if (typeof command === "string") {
        const match = command.match(CONSTANTS.REGEX.COMMAND);
        if (match) {
          cmd = match[1];
          cmdArgs = match[2] ? match[2].split(" ") : [];
        } else {
          cmd = command;
          cmdArgs = args || [];
        }
      } else {
        cmd = command;
        cmdArgs = args || [];
      }

      const handler = this.commands[cmd];
      if (!handler) {
        return this.sendError(
          ws,
          `Unknown command: ${cmd}`,
          CONSTANTS.ERROR_CODES.INVALID_COMMAND
        );
      }

      await handler(ws, connectionInfo, cmdArgs);
    } catch (error) {
      logger.error("Error handling command:", error);
      this.sendError(ws, "Failed to execute command");
    }
  }

  async handleRoomsCommand(ws, connectionInfo, args) {
    try {
      const limit = args[0] ? parseInt(args[0]) : 20;
      const rooms = await RoomService.getRoomList(limit);

      const roomList = rooms.map((room) => ({
        name: room.name,
        users: room.userCount,
        messages: room.messageCount,
        created: room.createdAt,
      }));

      this.sendMessage(ws, {
        type: CONSTANTS.MESSAGE_TYPES.ROOM_LIST,
        rooms: roomList,
        count: roomList.length,
        timestamp: new Date().toISOString(),
      });

      logger.debug(`Sent room list to ${connectionInfo.username}`);
    } catch (error) {
      logger.error("Error getting room list:", error);
      this.sendError(ws, "Failed to get room list");
    }
  }

  async handleUsersCommand(ws, connectionInfo, args) {
    try {
      if (connectionInfo.currentRoom) {
        const members = await RoomService.getRoomMembers(
          connectionInfo.currentRoom
        );

        this.sendMessage(ws, {
          type: CONSTANTS.MESSAGE_TYPES.USER_LIST,
          room: connectionInfo.currentRoomName,
          users: members.map((m) => ({
            username: m.username,
            userId: m.userId,
          })),
          count: members.length,
          timestamp: new Date().toISOString(),
        });
      } else {
        const onlineUsers = await UserService.getOnlineUsers();

        this.sendMessage(ws, {
          type: CONSTANTS.MESSAGE_TYPES.USER_LIST,
          room: null,
          users: onlineUsers.map((u) => ({
            username: u.username,
            userId: u.userId,
            currentRoom: u.currentRoom,
          })),
          count: onlineUsers.length,
          timestamp: new Date().toISOString(),
        });
      }

      logger.debug(`Sent user list to ${connectionInfo.username}`);
    } catch (error) {
      logger.error("Error getting user list:", error);
      this.sendError(ws, "Failed to get user list");
    }
  }

  async handleHelpCommand(ws, connectionInfo, args) {
    const helpText = `
Available commands:
  /rooms [limit]  - List active rooms
  /users         - List users in current room or all online users
  /stats         - Show chat statistics
  /me            - Show your information
  /clear         - Clear chat history (client-side)
  /help          - Show this help message

Room commands (when not in a room):
  create <room_name>  - Create a new room
  join <room_name>    - Join an existing room
  
Room commands (when in a room):
  leave              - Leave the current room
    `.trim();

    this.sendMessage(ws, {
      type: CONSTANTS.MESSAGE_TYPES.SYSTEM,
      message: helpText,
      timestamp: new Date().toISOString(),
    });
  }

  async handleStatsCommand(ws, connectionInfo, args) {
    try {
      const userInfo = await UserService.getUserInfo(connectionInfo.userId);
      const metrics = UserService.getMetrics();

      let roomStats = null;
      if (connectionInfo.currentRoom) {
        const roomInfo = await RoomService.getRoomInfo(
          connectionInfo.currentRoom
        );
        roomStats = {
          name: roomInfo.name,
          users: roomInfo.userCount,
          messages: roomInfo.messageCount,
          created: roomInfo.createdAt,
        };
      }

      const stats = {
        server: {
          activeConnections: metrics.activeConnections,
          uniqueUsers: metrics.uniqueUsers,
          uptime: Math.floor(process.uptime() / 60) + " minutes",
        },
        user: {
          totalMessages: userInfo?.totalMessages || 0,
          roomsJoined: userInfo?.metadata?.roomsJoined?.length || 0,
          connectedSince: connectionInfo.joinedAt,
        },
        currentRoom: roomStats,
      };

      this.sendMessage(ws, {
        type: CONSTANTS.MESSAGE_TYPES.SYSTEM,
        message: JSON.stringify(stats, null, 2),
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting stats:", error);
      this.sendError(ws, "Failed to get statistics");
    }
  }

  async handleMeCommand(ws, connectionInfo, args) {
    const info = {
      userId: connectionInfo.userId,
      username: connectionInfo.username,
      currentRoom: connectionInfo.currentRoomName || "None",
      connectedSince: connectionInfo.joinedAt,
      connectionId: connectionInfo.id,
    };

    this.sendMessage(ws, {
      type: CONSTANTS.MESSAGE_TYPES.SYSTEM,
      message: `Your information:\n${JSON.stringify(info, null, 2)}`,
      data: info,
      timestamp: new Date().toISOString(),
    });
  }

  async handleClearCommand(ws, connectionInfo, args) {
    this.sendMessage(ws, {
      type: "CLEAR_SCREEN",
      timestamp: new Date().toISOString(),
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
}

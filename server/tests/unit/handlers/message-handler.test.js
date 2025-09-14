import { MessageHandler } from "../../../src/handlers/MessageHandler.js";
import { CONSTANTS } from "../../../src/config/constants.js";

jest.mock("../../../src/services/MessageService.js", () => ({
  MessageService: {
    sendMessage: jest.fn(),
  },
}));

jest.mock("../../../src/services/RoomService.js", () => ({
  RoomService: {
    handleTypingIndicator: jest.fn(),
  },
}));

jest.mock("../../../src/utils/logger.js", () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../src/config/redis.js", () => ({
  getRedisSubClient: jest.fn(() => ({
    subscribe: jest.fn(),
    on: jest.fn(),
  })),
}));

describe("MessageHandler", () => {
  let messageHandler;
  let mockWebSocket;
  let mockConnectionInfo;

  beforeEach(() => {
    messageHandler = new MessageHandler();

    mockWebSocket = {
      send: jest.fn(),
      readyState: 1,
      OPEN: 1,
    };

    mockConnectionInfo = {
      userId: "user123",
      username: "testuser",
      currentRoom: "general",
    };

    jest.clearAllMocks();
  });

  describe("handleSendMessage", () => {
    test("sends message successfully", async () => {
      const message = { content: "Hello world!" };

      const {
        MessageService,
      } = require("../../../src/services/MessageService.js");
      MessageService.sendMessage.mockResolvedValue({
        success: true,
        message: {
          id: "msg123",
          content: "Hello world!",
          userId: "user123",
          username: "testuser",
          timestamp: new Date(),
        },
      });

      messageHandler.broadcastToRoom = jest.fn();

      await messageHandler.handleSendMessage(
        mockWebSocket,
        mockConnectionInfo,
        message
      );

      expect(MessageService.sendMessage).toHaveBeenCalledWith(
        "general",
        "user123",
        "testuser",
        "Hello world!"
      );
      expect(messageHandler.broadcastToRoom).toHaveBeenCalled();
    });

    test("rejects message when not in room", async () => {
      const message = { content: "Hello world!" };
      const connectionInfoNoRoom = { ...mockConnectionInfo, currentRoom: null };

      messageHandler.sendError = jest.fn();

      await messageHandler.handleSendMessage(
        mockWebSocket,
        connectionInfoNoRoom,
        message
      );

      expect(messageHandler.sendError).toHaveBeenCalledWith(
        mockWebSocket,
        "You must join a room first"
      );
    });

    test("rejects empty message content", async () => {
      const message = { content: "" };

      messageHandler.sendError = jest.fn();

      await messageHandler.handleSendMessage(
        mockWebSocket,
        mockConnectionInfo,
        message
      );

      expect(messageHandler.sendError).toHaveBeenCalledWith(
        mockWebSocket,
        "Message content is required"
      );
    });

    test("rejects message that is too long", async () => {
      const message = { content: "a".repeat(CONSTANTS.MAX_MESSAGE_LENGTH + 1) };

      messageHandler.sendError = jest.fn();

      await messageHandler.handleSendMessage(
        mockWebSocket,
        mockConnectionInfo,
        message
      );

      expect(messageHandler.sendError).toHaveBeenCalledWith(
        mockWebSocket,
        `Message too long (max ${CONSTANTS.MAX_MESSAGE_LENGTH} characters)`
      );
    });

    test("handles message service failure", async () => {
      const message = { content: "Hello world!" };

      const {
        MessageService,
      } = require("../../../src/services/MessageService.js");
      MessageService.sendMessage.mockResolvedValue({
        success: false,
        error: "Rate limit exceeded",
      });

      messageHandler.sendError = jest.fn();

      await messageHandler.handleSendMessage(
        mockWebSocket,
        mockConnectionInfo,
        message
      );

      expect(messageHandler.sendError).toHaveBeenCalledWith(
        mockWebSocket,
        "Rate limit exceeded"
      );
    });
  });

  describe("sendError", () => {
    test("sends error message to websocket", () => {
      messageHandler.sendMessage = jest.fn();

      messageHandler.sendError(mockWebSocket, "Test error message");

      expect(messageHandler.sendMessage).toHaveBeenCalledWith(mockWebSocket, {
        type: CONSTANTS.MESSAGE_TYPES.ERROR,
        error: {
          code: CONSTANTS.ERROR_CODES.INVALID_MESSAGE,
          message: "Test error message",
        },
        timestamp: expect.any(String),
      });
    });

    test("handles websocket send error gracefully", () => {
      mockWebSocket.readyState = 3;
      mockWebSocket.OPEN = 1;

      expect(() => {
        messageHandler.sendError(mockWebSocket, "Test error");
      }).not.toThrow();
    });
  });

  describe("broadcastToRoom", () => {
    test("broadcasts message to all connections in a room", () => {
      const mockConnectionHandler = {
        broadcastToRoom: jest.fn(),
      };
      messageHandler.connectionHandler = mockConnectionHandler;

      const mockMessage = {
        type: CONSTANTS.MESSAGE_TYPES.USER_MESSAGE,
        content: "Hello room!",
      };

      messageHandler.broadcastToRoom("room1", mockMessage);

      expect(mockConnectionHandler.broadcastToRoom).toHaveBeenCalledWith(
        "room1",
        mockMessage,
        null
      );
    });

    test("handles empty room gracefully", () => {
      messageHandler.roomClients = new Map();

      const messageData = {
        type: CONSTANTS.MESSAGE_TYPES.MESSAGE,
        content: "Hello room!",
      };

      expect(() => {
        messageHandler.broadcastToRoom("nonexistent", messageData);
      }).not.toThrow();
    });
  });
});

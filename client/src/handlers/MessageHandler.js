import logger from "../utils/logger.js";

export class MessageHandler {
  constructor(display, state) {
    this.display = display;
    this.state = state;
  }

  handle(message) {
    const { type } = message;

    switch (type) {
      case "message":
        this.handleMessage(message);
        break;

      case "message_history":
        this.handleMessageHistory(message);
        break;

      case "system":
        this.handleSystemMessage(message);
        break;

      case "notification":
        this.handleNotification(message);
        break;

      case "user_joined":
        this.handleUserJoined(message);
        break;

      case "user_left":
        this.handleUserLeft(message);
        break;

      case "typing_update":
        this.handleTypingUpdate(message);
        break;

      case "room_list":
        this.handleRoomList(message);
        break;

      case "user_list":
        this.handleUserList(message);
        break;

      case "error":
        this.handleError(message);
        break;

      case "room_joined":
        this.handleRoomJoined(message);
        break;

      case "room_left":
        this.handleRoomLeft(message);
        break;

      case "CLEAR_SCREEN":
        this.display.clear();
        break;

      default:
        logger.debug("Unhandled message type:", type);
    }
  }

  handleMessage(data) {
    const { message } = data;
    this.display.showMessage(message);
  }

  handleMessageHistory(data) {
    const { messages } = data;
    if (messages && messages.length > 0) {
      this.display.showMessageHistory(messages);
    }
  }

  handleSystemMessage(data) {
    const { message, timestamp } = data;
    this.display.showSystemMessage(message, timestamp);
  }

  handleNotification(data) {
    const { message, timestamp } = data;
    this.display.showNotification(message, timestamp);
  }

  handleUserJoined(data) {
    const { user, timestamp } = data;
    this.display.showUserJoined(user.username, timestamp);
  }

  handleUserLeft(data) {
    const { user, timestamp } = data;
    this.display.showUserLeft(user.username, timestamp);
  }

  handleTypingUpdate(data) {
    const { typingUsers } = data;

    const currentUsername = this.state.getUsername();
    const filteredUsers = typingUsers.filter((u) => u !== currentUsername);

    this.display.showTypingIndicator(filteredUsers);
  }

  handleRoomList(data) {
    const { rooms } = data;
    this.display.showRoomList(rooms);
  }

  handleUserList(data) {
    const { users, room } = data;
    this.display.showUserList(users, room);
  }

  handleError(data) {
    const { error, timestamp } = data;
    this.display.error(error.message);
  }

  handleRoomJoined(data) {
    const { room, members } = data;

    this.state.setCurrentRoom(room.id, room.name);
    this.display.showRoomInfo(room);

    if (members && members.length > 0) {
      this.display.info(`Members: ${members.join(", ")}`);
    }
  }

  handleRoomLeft(data) {
    const { roomName } = data;
    this.state.clearCurrentRoom();
    this.display.success(`Left room "${roomName}"`);
  }
}

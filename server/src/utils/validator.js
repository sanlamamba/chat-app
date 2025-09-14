import { CONSTANTS } from "../config/constants.js";

class Validator {
  validateUsername(username) {
    if (!username || typeof username !== "string") {
      return { valid: false, error: "Username is required" };
    }

    if (username.length < CONSTANTS.MIN_USERNAME_LENGTH) {
      return {
        valid: false,
        error: `Username must be at least ${CONSTANTS.MIN_USERNAME_LENGTH} characters`,
      };
    }

    if (username.length > CONSTANTS.MAX_USERNAME_LENGTH) {
      return {
        valid: false,
        error: `Username must be at most ${CONSTANTS.MAX_USERNAME_LENGTH} characters`,
      };
    }

    if (!CONSTANTS.REGEX.USERNAME.test(username)) {
      return {
        valid: false,
        error:
          "Username can only contain letters, numbers, underscores, and hyphens",
      };
    }

    return { valid: true };
  }

  validateRoomName(roomName) {
    if (!roomName || typeof roomName !== "string") {
      return { valid: false, error: "Room name is required" };
    }

    if (roomName.length < CONSTANTS.MIN_ROOM_NAME_LENGTH) {
      return {
        valid: false,
        error: `Room name must be at least ${CONSTANTS.MIN_ROOM_NAME_LENGTH} characters`,
      };
    }

    if (roomName.length > CONSTANTS.MAX_ROOM_NAME_LENGTH) {
      return {
        valid: false,
        error: `Room name must be at most ${CONSTANTS.MAX_ROOM_NAME_LENGTH} characters`,
      };
    }

    if (!CONSTANTS.REGEX.ROOM_NAME.test(roomName)) {
      return { valid: false, error: "Room name contains invalid characters" };
    }

    return { valid: true };
  }

  validateMessage(message) {
    if (!message || typeof message !== "string") {
      return { valid: false, error: "Message content is required" };
    }

    const trimmed = message.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: "Message cannot be empty" };
    }

    if (trimmed.length > CONSTANTS.MAX_MESSAGE_LENGTH) {
      return {
        valid: false,
        error: `Message must be at most ${CONSTANTS.MAX_MESSAGE_LENGTH} characters`,
      };
    }

    return { valid: true };
  }

  sanitizeContent(content) {
    return content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;")
      .trim();
  }

  unsanitizeContent(content) {
    return content
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/");
  }

  isCommand(message) {
    return message.startsWith("/") && CONSTANTS.REGEX.COMMAND.test(message);
  }

  parseCommand(message) {
    const match = message.match(CONSTANTS.REGEX.COMMAND);
    if (!match) return null;

    return {
      command: match[1],
      args: match[2] ? match[2].split(" ") : [],
    };
  }
}

export default new Validator();

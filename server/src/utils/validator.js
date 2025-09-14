import { CONSTANTS } from "../config/constants.js";

const htmlEntities = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "&": "&amp;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

const sqlInjectionPatterns = [
  /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UPDATE|UNION( +ALL)?)\b)/i,
  /(--|\/\*|\*\/|;)/,
  /('|(\\')|(;)|(,)|(>)|(<))/,
  /(xp_|sp_|admin)/i,
];

const xssPatterns = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload=/gi,
  /onerror=/gi,
  /onclick=/gi,
  /onmouseover=/gi,
  /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
  /<embed[\s\S]*?>[\s\S]*?<\/embed>/gi,
];

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
    if (typeof content !== "string") return "";

    let sanitized = content;
    xssPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "");
    });

    const hasSqlInjection = sqlInjectionPatterns.some((pattern) =>
      pattern.test(sanitized)
    );
    if (hasSqlInjection) {
      throw new Error("Content contains potentially harmful patterns");
    }

    sanitized = sanitized.replace(
      /[<>"'\/&`=]/g,
      (match) => htmlEntities[match] || match
    );

    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    sanitized = sanitized.replace(/\s{3,}/g, "  ");

    return sanitized.trim();
  }

  validateAndSanitizeInput(input, type = "text") {
    if (!input || typeof input !== "string") {
      return { valid: false, error: "Input is required", sanitized: "" };
    }

    try {
      const sanitized = this.sanitizeContent(input);

      switch (type) {
        case "username":
          return {
            valid: this.validateUsername(sanitized).valid,
            error: this.validateUsername(sanitized).error,
            sanitized,
          };
        case "roomname":
          return {
            valid: this.validateRoomName(sanitized).valid,
            error: this.validateRoomName(sanitized).error,
            sanitized,
          };
        case "message":
          return {
            valid: this.validateMessage(sanitized).valid,
            error: this.validateMessage(sanitized).error,
            sanitized,
          };
        default:
          return { valid: true, sanitized };
      }
    } catch (error) {
      return { valid: false, error: error.message, sanitized: "" };
    }
  }

  detectSpam(content, userId, recentMessages = []) {
    const triggers = {
      repetition: this.checkRepetition(content),
      caps: this.checkExcessiveCaps(content),
      duplicates: this.checkDuplicateMessages(content, recentMessages),
      links: this.checkSuspiciousLinks(content),
      length: content.length > CONSTANTS.MAX_MESSAGE_LENGTH * 0.8,
    };

    const spamScore = Object.values(triggers).reduce(
      (score, trigger) => score + (trigger ? 1 : 0),
      0
    );

    return {
      isSpam: spamScore >= 2,
      triggers,
      score: spamScore,
    };
  }

  checkRepetition(content) {
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = {};

    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const maxRepeats = Math.max(...Object.values(wordCount));
    return maxRepeats > words.length * 0.4;
  }

  checkExcessiveCaps(content) {
    const capsCount = (content.match(/[A-Z]/g) || []).length;
    return content.length > 10 && capsCount / content.length > 0.9;
  }

  checkDuplicateMessages(content, recentMessages) {
    return recentMessages.some(
      (msg) => msg.toLowerCase().trim() === content.toLowerCase().trim()
    );
  }

  checkSuspiciousLinks(content) {
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urls = content.match(urlPattern) || [];

    const suspiciousDomains = [
      "bit.ly",
      "tinyurl.com",
      "shortened.link",
      "discord.gg",
      "telegram.me",
    ];

    return urls.some((url) =>
      suspiciousDomains.some((domain) => url.includes(domain))
    );
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

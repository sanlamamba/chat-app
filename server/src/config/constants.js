export const CONSTANTS = {
  // WebSocket
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 60000, // 60 seconds
  MAX_MESSAGE_SIZE: 65536, // 64KB

  // Messages
  MAX_MESSAGE_LENGTH: 4096,
  MESSAGE_HISTORY_LIMIT: 20,

  // Rooms
  MAX_ROOM_NAME_LENGTH: 50,
  MIN_ROOM_NAME_LENGTH: 3,
  MAX_ROOMS_PER_USER: 10,

  // Users
  MAX_USERNAME_LENGTH: 30,
  MIN_USERNAME_LENGTH: 2,

  // Rate Limiting
  RATE_LIMIT_MESSAGES: {
    POINTS: 10, // Number of messages
    DURATION: 1, // Per second
    BLOCK_DURATION: 60 // Block for 60 seconds if exceeded
  },
  RATE_LIMIT_ROOMS: {
    POINTS: 5, // Number of room creations
    DURATION: 3600, // Per hour
    BLOCK_DURATION: 3600 // Block for 1 hour if exceeded
  },

  // Cache
  CACHE_TTL: {
    ROOM_INFO: 300, // 5 minutes
    USER_INFO: 600, // 10 minutes
    MESSAGE_HISTORY: 60 // 1 minute
  },

  // Typing Indicator
  TYPING_INDICATOR_TTL: 3, // 3 seconds

  // WebSocket Message Types
  MESSAGE_TYPES: {
    // Client to Server
    AUTH: 'auth',
    JOIN_ROOM: 'join_room',
    CREATE_ROOM: 'create_room',
    LEAVE_ROOM: 'leave_room',
    SEND_MESSAGE: 'send_message',
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop',
    COMMAND: 'command',

    // Server to Client
    AUTH_SUCCESS: 'auth_success',
    AUTH_ERROR: 'auth_error',
    ROOM_JOINED: 'room_joined',
    ROOM_CREATED: 'room_created',
    ROOM_LEFT: 'room_left',
    MESSAGE: 'message',
    MESSAGE_HISTORY: 'message_history',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',
    TYPING_UPDATE: 'typing_update',
    ROOM_LIST: 'room_list',
    USER_LIST: 'user_list',
    ERROR: 'error',
    SYSTEM: 'system',
    NOTIFICATION: 'notification'
  },

  // Error Codes
  ERROR_CODES: {
    INVALID_MESSAGE: 'INVALID_MESSAGE',
    UNAUTHORIZED: 'UNAUTHORIZED',
    ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
    ROOM_EXISTS: 'ROOM_EXISTS',
    USER_EXISTS: 'USER_EXISTS',
    RATE_LIMIT: 'RATE_LIMIT',
    INVALID_COMMAND: 'INVALID_COMMAND',
    DATABASE_ERROR: 'DATABASE_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  },

  // Validation Regex
  REGEX: {
    USERNAME: /^[a-zA-Z0-9_-]{2,30}$/,
    ROOM_NAME: /^[a-zA-Z0-9_-\s]{3,50}$/,
    COMMAND: /^\/([a-z]+)(?:\s+(.*))?$/
  }
};

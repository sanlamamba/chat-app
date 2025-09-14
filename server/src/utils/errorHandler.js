import { v4 as uuidv4 } from "uuid";
import { CONSTANTS } from "../config/constants.js";
import logger from "./logger.js";

export class AppError extends Error {
  constructor(
    message,
    statusCode,
    code = CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
    correlationId = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.correlationId = correlationId || uuidv4();
    this.timestamp = new Date().toISOString();
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      type: CONSTANTS.MESSAGE_TYPES.ERROR,
      error: {
        code: this.code,
        message: this.message,
        correlationId: this.correlationId,
        timestamp: this.timestamp,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null, correlationId = null) {
    super(message, 400, CONSTANTS.ERROR_CODES.INVALID_MESSAGE, correlationId);
    this.field = field;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.field) {
      json.error.field = this.field;
    }
    return json;
  }
}

export class RateLimitError extends AppError {
  constructor(message, retryAfter, correlationId = null) {
    super(message, 429, CONSTANTS.ERROR_CODES.RATE_LIMIT, correlationId);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    const json = super.toJSON();
    json.error.retryAfter = this.retryAfter;
    return json;
  }
}

export class DatabaseError extends AppError {
  constructor(message, operation = null, correlationId = null) {
    super(message, 500, CONSTANTS.ERROR_CODES.DATABASE_ERROR, correlationId);
    this.operation = operation;
  }
}

export function createErrorResponse(error, ws = null, correlationId = null) {
  const errorId = correlationId || uuidv4();

  let response;

  if (error instanceof AppError) {
    response = error.toJSON();
    response.error.correlationId = response.error.correlationId || errorId;
  } else {
    response = {
      type: CONSTANTS.MESSAGE_TYPES.ERROR,
      error: {
        code: CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message:
          process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : error.message,
        correlationId: errorId,
        timestamp: new Date().toISOString(),
      },
    };

    logger.error("Unhandled error", {
      service: "error-handler",
      error: error.message,
      stack: error.stack,
      correlationId: errorId,
    });
  }

  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(response));
  }

  return response;
}

export function wrapAsyncHandler(handler) {
  return async (ws, connectionInfo, message) => {
    const correlationId = uuidv4();

    try {
      connectionInfo.lastCorrelationId = correlationId;

      await handler(ws, connectionInfo, message);
    } catch (error) {
      logger.error("Handler error", {
        service: "error-handler",
        handler: handler.name,
        userId: connectionInfo.userId,
        error: error.message,
        correlationId,
        message: message?.type,
      });

      createErrorResponse(error, ws, correlationId);
    }
  };
}

export function logError(error, context = {}) {
  logger.error("Application error", {
    service: "error-handler",
    error: error.message,
    stack: error.stack,
    correlationId: error.correlationId || uuidv4(),
    ...context,
  });
}

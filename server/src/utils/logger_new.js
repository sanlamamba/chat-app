import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      service,
      userId,
      roomId,
      action,
      duration,
      ...meta
    } = info;

    let msg = `${timestamp} [${level}]`;

    if (service) {
      msg += ` [${service}]`;
    }

    msg += `: ${message}`;

    const context = [];
    if (userId) context.push(`user=${userId}`);
    if (roomId) context.push(`room=${roomId}`);
    if (action) context.push(`action=${action}`);
    if (duration !== undefined) context.push(`${duration}ms`);

    if (context.length > 0) {
      msg += ` (${context.join(', ')})`;
    }

    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat
  })
];

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: fileFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: fileFormat
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels: logLevels,
  format: consoleFormat,
  transports,
  exitOnError: false
});

logger.stream = {
  write: (message) => logger.http(message.trim())
};

export default logger;

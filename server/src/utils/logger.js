import winston from 'winston';
import path from 'path';

const __dirname = process.cwd();

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
      const hasComplexObjects = Object.values(meta).some(
        (value) =>
          typeof value === 'object' && value !== null && !Array.isArray(value)
      );

      if (hasComplexObjects) {
        msg += '\n  ';
        const formatted = Object.entries(meta)
          .map(([key, value]) => {
            if (
              typeof value === 'object' &&
              value !== null &&
              !Array.isArray(value)
            ) {
              return `${key}: ${JSON.stringify(value, null, 2).replace(
                /\n/g,
                '\n    '
              )}`;
            }
            return `${key}: ${JSON.stringify(value)}`;
          })
          .join('\n  ');
        msg += formatted;
      } else {
        const formatted = Object.entries(meta)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(', ');
        msg += ` | ${formatted}`;
      }
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
      filename: path.join(__dirname, 'logs/error.log'),
      level: 'error',
      format: fileFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, 'logs/combined.log'),
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

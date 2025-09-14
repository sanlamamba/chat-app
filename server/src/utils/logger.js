import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let msg = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

const transports = [
  new winston.transports.Console({
    format: format,
  }),
];

if (process.env.NODE_ENV === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      format: winston.format.uncolorize(),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      format: winston.format.uncolorize(),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  levels: logLevels,
  format,
  transports,
  exitOnError: false,
});

logger.stream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;

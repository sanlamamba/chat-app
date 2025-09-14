import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logToFile = process.env.LOG_TO_FILE === 'true';
    this.logFile = path.join(__dirname, '../../logs/client.log');

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  writeToFile(message) {
    if (this.logToFile) {
      fs.appendFileSync(this.logFile, message + '\n');
    }
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message, ...args);
      if (process.env.NODE_ENV !== 'production') {
        console.error(formatted);
      }
      this.writeToFile(formatted);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, ...args);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(formatted);
      }
      this.writeToFile(formatted);
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, ...args);
      if (process.env.NODE_ENV !== 'production') {
        console.log(formatted);
      }
      this.writeToFile(formatted);
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message, ...args);
      if (process.env.NODE_ENV !== 'production') {
        console.log(formatted);
      }
      this.writeToFile(formatted);
    }
  }
}

export default new Logger();

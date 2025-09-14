#!/usr/bin/env node

import 'dotenv/config';
import figlet from 'figlet';
import chalk from 'chalk';
import { ChatClient } from './core/ChatClient.js';
import { Display } from './ui/Display.js';
import logger from './utils/logger.js';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:3000';

async function main() {
  try {
    console.clear();

    const banner = figlet.textSync('Chat CLI', {
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });

    console.log(chalk.cyan(banner));
    console.log(chalk.gray('Real-time chat application with rooms'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const display = new Display();

    const client = new ChatClient(SERVER_URL, display);

    await client.start();
  } catch (error) {
    logger.error('Failed to start chat client:', error);
    console.error(chalk.red('Failed to start chat client:', error.message));
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down gracefully...'));
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error(chalk.red('Fatal error:', error.message));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error(chalk.red('Unhandled promise rejection:', reason));
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red('Fatal error:', error.message));
  process.exit(1);
});

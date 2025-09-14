import inquirer from 'inquirer';
import { WebSocketClient } from './WebSocketClient.js';
import { StateManager } from '../services/StateManager.js';
import { MessageHandler } from '../handlers/MessageHandler.js';
import { CommandHandler } from '../handlers/CommandHandler.js';
import { InputManager } from '../ui/InputManager.js';
import { Prompt } from '../ui/Prompt.js';
import chalk from 'chalk';
import logger from '../utils/logger.js';

export class ChatClient {
  constructor(serverUrl, display) {
    this.serverUrl = serverUrl;
    this.display = display;
    this.state = new StateManager();
    this.wsClient = null;
    this.messageHandler = null;
    this.commandHandler = null;
    this.inputManager = null;
    this.prompt = new Prompt();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isShuttingDown = false;
    this.isReconnecting = false;
  }

  async start() {
    try {
      const username = await this.prompt.getUsername();
      this.state.setUsername(username);

      await this.connect();
      await this.authenticate(username);

      await this.handleInitialSetup();

      this.startInputManager();
    } catch (error) {
      logger.error('Error starting client:', error);
      this.display.error('Failed to start: ' + error.message);
      process.exit(1);
    }
  }

  async handleInitialSetup() {
    while (true) {
      const action = await this.showMainMenu();

      if (action === 'exit') {
        this.exit();
        return;
      }

      if (action === 'create' || action === 'join') {
        break;
      }

      // Continue loop for "list" or other actions that don't change room state
    }
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    this.display.showConnecting(this.serverUrl);

    return new Promise((resolve, reject) => {
      this.wsClient = new WebSocketClient(this.serverUrl);

      this.messageHandler = new MessageHandler(this.display, this.state, {
        onRoomStateChange: () => {
          if (this.inputManager) {
            this.inputManager.updatePrompt();
          }
        }
      });
      this.commandHandler = new CommandHandler(
        this.wsClient,
        this.state,
        this.display
      );

      this.wsClient.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.display.stopSpinner(true, 'Connected to server');
        resolve();
      });

      this.wsClient.on('message', (data) => {
        this.handleMessage(data);
      });

      this.wsClient.on('close', (code, reason) => {
        if (this.isShuttingDown) return;

        this.isConnected = false;

        // Only show warnings if we're not already in a reconnection cycle
        if (!this.isReconnecting) {
          this.display.stopSpinner(false);
          this.display.warning(
            `Connection lost: ${reason || 'Unknown reason'}`
          );
        }

        this.handleReconnect();
      });

      this.wsClient.on('error', (error) => {
        this.display.stopSpinner(false, 'Connection error: ' + error.message);
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.wsClient.connect();
    });
  }

  async authenticate(username) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 10000);

      const authHandler = (data) => {
        const message = JSON.parse(data);

        if (message.type === 'auth_success') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', authHandler);
          this.state.setUserId(message.user.userId);
          this.display.success(`Authenticated as ${username}`);
          resolve();
        } else if (message.type === 'auth_error') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', authHandler);
          reject(new Error(message.error.message));
        }
      };

      this.wsClient.on('message', authHandler);

      this.wsClient.send({
        type: 'auth',
        username
      });
    });
  }

  async showMainMenu() {
    console.log(chalk.cyan('\n🏠 Main Menu'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white('Available commands:'));
    console.log(
      chalk.green('  /create   ') + chalk.gray('- Create a new room')
    );
    console.log(
      chalk.green('  /join     ') + chalk.gray('- Join an existing room')
    );
    console.log(
      chalk.green('  /list     ') + chalk.gray('- List available rooms')
    );
    console.log(chalk.green('  /exit     ') + chalk.gray('- Exit application'));
    console.log(chalk.gray('─'.repeat(50)));

    const { action } = await inquirer.prompt([
      {
        type: 'input',
        name: 'action',
        message: 'Enter command:',
        validate: (input) => {
          const validCommands = ['/create', '/join', '/list', '/exit'];
          if (!input.startsWith('/')) {
            return 'Commands must start with \'/\' (e.g., /create, /join, /list, /exit)';
          }
          if (!validCommands.includes(input.toLowerCase())) {
            return 'Invalid command. Use: /create, /join, /list, or /exit';
          }
          return true;
        }
      }
    ]);

    const command = action.toLowerCase();

    switch (command) {
      case '/create':
        await this.createRoom();
        return 'create';
      case '/join':
        await this.joinRoom();
        return 'join';
      case '/list':
        await this.listRooms();
        return 'list';
      case '/exit':
        return 'exit';
    }
  }

  async createRoom() {
    const roomName = await this.prompt.getRoomName('Enter room name:');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.wsClient.removeListener('message', handler);
        this.display.error('Room creation timeout');
        resolve('error');
      }, 10000);

      const handler = (data) => {
        const message = JSON.parse(data);

        if (message.type === 'room_created') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', handler);
          this.state.setCurrentRoom(message.room.id, message.room.name);
          this.display.success(
            `Room "${message.room.name}" created successfully!`
          );
          resolve();
        } else if (message.type === 'error') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', handler);
          this.display.error(message.error.message);
          resolve('error');
        }
      };

      this.wsClient.on('message', handler);

      this.wsClient.send({
        type: 'create_room',
        roomName
      });
    });
  }

  async joinRoom() {
    const roomName = await this.prompt.getRoomName('Enter room name to join:');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.wsClient.removeListener('message', handler);
        this.display.error('Room join timeout');
        resolve('error');
      }, 10000);

      const handler = (data) => {
        const message = JSON.parse(data);

        if (message.type === 'room_joined') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', handler);
          this.state.setCurrentRoom(message.room.id, message.room.name);
          this.display.success(`Joined room "${message.room.name}"!`);
          this.display.info(`${message.room.memberCount} users in room`);
          resolve();
        } else if (message.type === 'error') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', handler);
          this.display.error(message.error.message);
          resolve('error');
        }
      };

      this.wsClient.on('message', handler);

      this.wsClient.send({
        type: 'join_room',
        roomName
      });
    });
  }

  async listRooms() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.wsClient.removeListener('message', handler);
        this.display.error('Room list request timeout');
        resolve('error');
      }, 10000);

      const handler = (data) => {
        const message = JSON.parse(data);

        if (message.type === 'room_list') {
          clearTimeout(timeout);
          this.wsClient.removeListener('message', handler);
          // The MessageHandler will display the rooms via this.display.showRoomList()
          // so we don't need to display here
          resolve();
        }
      };

      this.wsClient.on('message', handler);

      this.wsClient.send({
        type: 'command',
        command: 'rooms'
      });
    });
  }

  startInputManager() {
    this.inputManager = new InputManager(
      this.wsClient,
      this.state,
      this.display,
      this.commandHandler
    );

    this.inputManager.start();
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      this.messageHandler.handle(message);
    } catch (error) {
      logger.error('Error parsing message:', error);
    }
  }

  async handleReconnect() {
    if (
      this.isShuttingDown ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.display.error('Max reconnection attempts reached. Exiting...');
      }
      process.exit(1);
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    this.display.warning(
      `Reconnecting in ${delay / 1000} seconds... (Attempt ${
        this.reconnectAttempts
      }/${this.maxReconnectAttempts})`
    );

    setTimeout(async () => {
      try {
        await this.connect();
        await this.authenticate(this.state.getUsername());

        // Reset reconnection state on successful connection
        this.isReconnecting = false;
        this.reconnectAttempts = 0;

        const currentRoom = this.state.getCurrentRoom();
        if (currentRoom) {
          this.wsClient.send({
            type: 'join_room',
            roomName: currentRoom.name
          });
        }

        this.display.success('Reconnected successfully!');

        // Update prompt if InputManager is running
        if (this.inputManager) {
          this.inputManager.updatePrompt();
        }
      } catch {
        this.handleReconnect();
      }
    }, delay);
  }

  exit() {
    this.isShuttingDown = true;
    this.display.info('Goodbye!');
    if (this.wsClient) {
      this.wsClient.close();
    }
    process.exit(0);
  }
}

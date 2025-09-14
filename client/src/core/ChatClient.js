import inquirer from "inquirer";
import { WebSocketClient } from "./WebSocketClient.js";
import { StateManager } from "../services/StateManager.js";
import { MessageHandler } from "../handlers/MessageHandler.js";
import { CommandHandler } from "../handlers/CommandHandler.js";
import { InputManager } from "../ui/InputManager.js";
import { Prompt } from "../ui/Prompt.js";
import chalk from "chalk";
import logger from "../utils/logger.js";

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
  }

  async start() {
    try {
      const username = await this.prompt.getUsername();
      this.state.setUsername(username);

      await this.connect();

      await this.authenticate(username);

      await this.showMainMenu();

      this.startInputManager();
    } catch (error) {
      logger.error("Error starting client:", error);
      this.display.error("Failed to start: " + error.message);
      process.exit(1);
    }
  }

  async connect() {
    this.display.showConnecting(this.serverUrl);

    return new Promise((resolve, reject) => {
      this.wsClient = new WebSocketClient(this.serverUrl);

      this.messageHandler = new MessageHandler(this.display, this.state);
      this.commandHandler = new CommandHandler(
        this.wsClient,
        this.state,
        this.display
      );

      this.wsClient.on("open", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.display.success("Connected to server");
        resolve();
      });

      this.wsClient.on("message", (data) => {
        this.handleMessage(data);
      });

      this.wsClient.on("close", (code, reason) => {
        this.isConnected = false;
        this.display.warning(
          `Connection closed: ${reason || "Unknown reason"}`
        );
        this.handleReconnect();
      });

      this.wsClient.on("error", (error) => {
        this.display.error("Connection error: " + error.message);
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
        reject(new Error("Authentication timeout"));
      }, 10000);

      const authHandler = (data) => {
        const message = JSON.parse(data);

        if (message.type === "auth_success") {
          clearTimeout(timeout);
          this.wsClient.removeListener("message", authHandler);
          this.state.setUserId(message.user.userId);
          this.display.success(`Authenticated as ${username}`);
          resolve();
        } else if (message.type === "auth_error") {
          clearTimeout(timeout);
          this.wsClient.removeListener("message", authHandler);
          reject(new Error(message.error.message));
        }
      };

      this.wsClient.on("message", authHandler);

      this.wsClient.send({
        type: "auth",
        username,
      });
    });
  }

  async showMainMenu() {
    const choices = [
      { name: "Create a new room", value: "create" },
      { name: "Join an existing room", value: "join" },
      { name: "List available rooms", value: "list" },
      { name: "Exit", value: "exit" },
    ];

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices,
      },
    ]);

    switch (action) {
      case "create":
        await this.createRoom();
        break;
      case "join":
        await this.joinRoom();
        break;
      case "list":
        await this.listRooms();
        await this.showMainMenu();
        break;
      case "exit":
        this.exit();
        break;
    }
  }

  async createRoom() {
    const roomName = await this.prompt.getRoomName("Enter room name:");

    return new Promise((resolve) => {
      const handler = (data) => {
        const message = JSON.parse(data);

        if (message.type === "room_created") {
          this.wsClient.removeListener("message", handler);
          this.state.setCurrentRoom(message.room.id, message.room.name);
          this.display.success(
            `Room "${message.room.name}" created successfully!`
          );
          resolve();
        } else if (message.type === "error") {
          this.wsClient.removeListener("message", handler);
          this.display.error(message.error.message);
          this.showMainMenu();
        }
      };

      this.wsClient.on("message", handler);

      this.wsClient.send({
        type: "create_room",
        roomName,
      });
    });
  }

  async joinRoom() {
    const roomName = await this.prompt.getRoomName("Enter room name to join:");

    return new Promise((resolve) => {
      const handler = (data) => {
        const message = JSON.parse(data);

        if (message.type === "room_joined") {
          this.wsClient.removeListener("message", handler);
          this.state.setCurrentRoom(message.room.id, message.room.name);
          this.display.success(`Joined room "${message.room.name}"!`);
          this.display.info(`${message.room.memberCount} users in room`);
          resolve();
        } else if (message.type === "error") {
          this.wsClient.removeListener("message", handler);
          this.display.error(message.error.message);
          this.showMainMenu();
        }
      };

      this.wsClient.on("message", handler);

      this.wsClient.send({
        type: "join_room",
        roomName,
      });
    });
  }

  async listRooms() {
    return new Promise((resolve) => {
      const handler = (data) => {
        const message = JSON.parse(data);

        if (message.type === "room_list") {
          this.wsClient.removeListener("message", handler);

          if (message.rooms.length === 0) {
            this.display.info("No active rooms found");
          } else {
            console.log(chalk.cyan("\nActive Rooms:"));
            console.log(chalk.gray("─".repeat(50)));

            message.rooms.forEach((room) => {
              console.log(chalk.white(`  • ${room.name}`));
              console.log(
                chalk.gray(
                  `    Users: ${room.users} | Messages: ${room.messages}`
                )
              );
            });

            console.log(chalk.gray("─".repeat(50)));
          }

          resolve();
        }
      };

      this.wsClient.on("message", handler);

      this.wsClient.send({
        type: "command",
        command: "rooms",
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
      logger.error("Error parsing message:", error);
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.display.error("Max reconnection attempts reached. Exiting...");
      process.exit(1);
    }

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

        const currentRoom = this.state.getCurrentRoom();
        if (currentRoom) {
          this.wsClient.send({
            type: "join_room",
            roomName: currentRoom.name,
          });
        }
      } catch (error) {
        this.handleReconnect();
      }
    }, delay);
  }

  exit() {
    this.display.info("Goodbye!");
    if (this.wsClient) {
      this.wsClient.close();
    }
    process.exit(0);
  }
}

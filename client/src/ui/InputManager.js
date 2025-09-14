import readline from "readline";
import chalk from "chalk";
import logger from "../utils/logger.js";

export class InputManager {
  constructor(wsClient, state, display, commandHandler) {
    this.wsClient = wsClient;
    this.state = state;
    this.display = display;
    this.commandHandler = commandHandler;
    this.rl = null;
    this.isTyping = false;
    this.typingTimer = null;
  }

  start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      historySize: 100,
      removeHistoryDuplicates: true,
    });

    this.rl.prompt();

    this.rl.on("line", (input) => {
      this.handleInput(input.trim());
    });

    this.rl.on("close", () => {
      console.log(chalk.yellow("\nGoodbye!"));
      process.exit(0);
    });

    this.rl.on("SIGINT", () => {
      this.confirmExit();
    });

    process.stdin.on("keypress", () => {
      this.handleTypingIndicator();
    });
  }

  handleInput(input) {
    if (!input) {
      this.rl.prompt();
      return;
    }

    if (input.startsWith("/")) {
      this.handleCommand(input);
    } else {
      this.sendMessage(input);
    }

    this.rl.prompt();
  }

  handleCommand(input) {
    const parts = input.slice(1).split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case "rooms":
        this.wsClient.send({
          type: "command",
          command: "rooms",
          args,
        });
        break;

      case "users":
        this.wsClient.send({
          type: "command",
          command: "users",
          args,
        });
        break;

      case "leave":
        this.leaveRoom();
        break;

      case "join":
        if (args.length === 0) {
          this.display.error("Usage: /join <room_name>");
        } else {
          this.joinRoom(args.join(" "));
        }
        break;

      case "create":
        if (args.length === 0) {
          this.display.error("Usage: /create <room_name>");
        } else {
          this.createRoom(args.join(" "));
        }
        break;

      case "clear":
        this.display.clear();
        break;

      case "help":
        this.display.showHelp();
        break;

      case "stats":
        this.wsClient.send({
          type: "command",
          command: "stats",
        });
        break;

      case "me":
        this.showUserInfo();
        break;

      case "exit":
      case "quit":
        this.confirmExit();
        break;

      default:
        this.display.error(`Unknown command: /${command}`);
        this.display.info("Type /help for available commands");
    }
  }

  sendMessage(content) {
    const currentRoom = this.state.getCurrentRoom();

    if (!currentRoom) {
      this.display.error("You must join a room first to send messages");
      this.display.info("Use /join <room_name> or /create <room_name>");
      return;
    }

    this.wsClient.send({
      type: "send_message",
      content,
    });

    this.stopTyping();
  }

  joinRoom(roomName) {
    this.wsClient.send({
      type: "join_room",
      roomName,
    });
  }

  createRoom(roomName) {
    this.wsClient.send({
      type: "create_room",
      roomName,
    });
  }

  leaveRoom() {
    const currentRoom = this.state.getCurrentRoom();

    if (!currentRoom) {
      this.display.error("You are not in a room");
      return;
    }

    this.wsClient.send({
      type: "leave_room",
    });

    this.state.clearCurrentRoom();
    this.updatePrompt();
  }

  handleTypingIndicator() {
    const currentRoom = this.state.getCurrentRoom();
    if (!currentRoom) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.wsClient.send({
        type: "typing_start",
      });
    }

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    this.typingTimer = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      this.wsClient.send({
        type: "typing_stop",
      });
    }

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  showUserInfo() {
    const username = this.state.getUsername();
    const userId = this.state.getUserId();
    const currentRoom = this.state.getCurrentRoom();

    console.log(chalk.cyan("\n👤 Your Information:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white(`  Username: ${username}`));
    console.log(chalk.white(`  User ID: ${userId}`));
    console.log(
      chalk.white(`  Current Room: ${currentRoom ? currentRoom.name : "None"}`)
    );
    console.log(chalk.gray("─".repeat(50)) + "\n");
  }

  confirmExit() {
    this.rl.question(
      chalk.yellow("Are you sure you want to exit? (y/n) "),
      (answer) => {
        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
          console.log(chalk.yellow("Goodbye!"));
          process.exit(0);
        } else {
          this.rl.prompt();
        }
      }
    );
  }

  updatePrompt() {
    if (this.rl) {
      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
    }
  }

  getPrompt() {
    const username = this.state.getUsername() || "Anonymous";
    const currentRoom = this.state.getCurrentRoom();

    if (currentRoom) {
      return (
        chalk.green(`[${currentRoom.name}] `) + chalk.cyan(`${username}> `)
      );
    } else {
      return chalk.cyan(`${username}> `);
    }
  }
}

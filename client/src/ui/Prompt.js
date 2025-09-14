import inquirer from "inquirer";
import chalk from "chalk";

export class Prompt {
  async getUsername() {
    const { username } = await inquirer.prompt([
      {
        type: "input",
        name: "username",
        message: "Enter your username:",
        validate: (input) => {
          if (!input || input.trim().length < 2) {
            return "Username must be at least 2 characters";
          }
          if (input.length > 30) {
            return "Username must be at most 30 characters";
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return "Username can only contain letters, numbers, underscores, and hyphens";
          }
          return true;
        },
        filter: (input) => input.trim(),
      },
    ]);

    return username;
  }

  async getRoomName(message = "Enter room name:") {
    const { roomName } = await inquirer.prompt([
      {
        type: "input",
        name: "roomName",
        message,
        validate: (input) => {
          if (!input || input.trim().length < 3) {
            return "Room name must be at least 3 characters";
          }
          if (input.length > 50) {
            return "Room name must be at most 50 characters";
          }
          if (!/^[a-zA-Z0-9_\-\s]+$/.test(input)) {
            return "Room name can only contain letters, numbers, spaces, underscores, and hyphens";
          }
          return true;
        },
        filter: (input) => input.trim(),
      },
    ]);

    return roomName;
  }

  async confirmAction(message) {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message,
        default: false,
      },
    ]);

    return confirmed;
  }

  async selectFromList(message, choices) {
    const { selected } = await inquirer.prompt([
      {
        type: "list",
        name: "selected",
        message,
        choices,
      },
    ]);

    return selected;
  }

  async getServerUrl() {
    const { url } = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "Enter server URL:",
        default: "ws://localhost:3000",
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return "Please enter a valid WebSocket URL (e.g., ws://localhost:3000)";
          }
        },
      },
    ]);

    return url;
  }
}

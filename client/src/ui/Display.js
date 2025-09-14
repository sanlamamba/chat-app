import chalk from "chalk";
import ora from "ora";

export class Display {
  constructor() {
    this.spinner = null;
  }

  showMessage(message) {
    const time = this.formatTime(message.timestamp);
    const username = chalk.cyan(message.username);
    const content = message.content;

    console.log(`[${chalk.gray(time)}] ${username}: ${content}`);
  }

  showSystemMessage(content, timestamp) {
    const time = this.formatTime(timestamp);
    console.log(
      `[${chalk.gray(time)}] ${chalk.yellow("System")}: ${chalk.italic(
        content
      )}`
    );
  }

  showNotification(content, timestamp) {
    const time = this.formatTime(timestamp);
    console.log(`[${chalk.gray(time)}] ${chalk.green(content)}`);
  }

  showUserJoined(username, timestamp) {
    const time = this.formatTime(timestamp);
    console.log(
      `[${chalk.gray(time)}] ${chalk.green(`➤ ${username} a rejoint la salle`)}`
    );
  }

  showUserLeft(username, timestamp) {
    const time = this.formatTime(timestamp);
    console.log(
      `[${chalk.gray(time)}] ${chalk.red(`⬅ ${username} a quitté la salle`)}`
    );
  }

  showTypingIndicator(users) {
    if (users.length === 0) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      return;
    }

    let text;
    if (users.length === 1) {
      text = `${users[0]} est en train d'écrire...`;
    } else if (users.length === 2) {
      text = `${users[0]} et ${users[1]} sont en train d'écrire...`;
    } else {
      text = `${users.length} personnes sont en train d'écrire...`;
    }

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(chalk.gray.italic(text));
  }

  showMessageHistory(messages) {
    if (messages.length === 0) return;

    console.log(chalk.gray("\n─── Message History ───"));
    messages.forEach((msg) => {
      this.showMessage(msg);
    });
    console.log(chalk.gray("─── End of History ───\n"));
  }

  showRoomList(rooms) {
    console.log(chalk.cyan("\n📋 Active Rooms:"));
    console.log(chalk.gray("─".repeat(50)));

    if (rooms.length === 0) {
      console.log(chalk.gray("  No active rooms"));
    } else {
      rooms.forEach((room) => {
        console.log(chalk.white(`  • ${room.name}`));
        console.log(
          chalk.gray(
            `    👥 ${room.users} users | 💬 ${room.messages} messages`
          )
        );
      });
    }

    console.log(chalk.gray("─".repeat(50)) + "\n");
  }

  showUserList(users, roomName = null) {
    const title = roomName ? `Users in "${roomName}"` : "Online Users";
    console.log(chalk.cyan(`\n👥 ${title}:`));
    console.log(chalk.gray("─".repeat(50)));

    if (users.length === 0) {
      console.log(chalk.gray("  No users"));
    } else {
      users.forEach((user) => {
        const status = user.currentRoom
          ? chalk.gray(` (in ${user.currentRoom})`)
          : "";
        console.log(chalk.white(`  • ${user.username}${status}`));
      });
    }

    console.log(chalk.gray("─".repeat(50)) + "\n");
  }

  success(message) {
    console.log(chalk.green(`✔ ${message}`));
  }

  error(message) {
    console.log(chalk.red(`✖ ${message}`));
  }

  warning(message) {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  info(message) {
    console.log(chalk.blue(`ℹ ${message}`));
  }

  showConnecting(url) {
    if (this.spinner) {
      this.spinner.stop();
    }

    this.spinner = ora({
      text: `Connecting to ${url}...`,
      spinner: "dots",
    }).start();
  }

  stopSpinner(success = true, message = "") {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message || "Done");
      } else {
        this.spinner.fail(message || "Failed");
      }
      this.spinner = null;
    }
  }

  clear() {
    console.clear();
  }

  showHelp() {
    console.log(chalk.cyan("\n📖 Available Commands:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white("  /rooms       - List all active rooms"));
    console.log(chalk.white("  /users       - List users in current room"));
    console.log(chalk.white("  /join <name> - Join a specific room"));
    console.log(chalk.white("  /create <name> - Create a new room"));
    console.log(chalk.white("  /leave       - Leave current room"));
    console.log(chalk.white("  /clear       - Clear screen"));
    console.log(chalk.white("  /help        - Show this help"));
    console.log(chalk.white("  /me          - Show your info"));
    console.log(chalk.white("  /stats       - Show server statistics"));
    console.log(chalk.white("  /exit        - Exit application"));
    console.log(chalk.gray("─".repeat(50)) + "\n");
    console.log(
      chalk.gray(
        "💡 Tip: Just type your message to send it to the current room"
      )
    );
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  showRoomInfo(room) {
    console.log(chalk.cyan("\n  Current Room:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white(`  Name: ${room.name}`));
    console.log(chalk.white(`  ID: ${room.id}`));
    console.log(chalk.white(`  Members: ${room.memberCount || "Unknown"}`));
    console.log(chalk.gray("─".repeat(50)) + "\n");
  }
}

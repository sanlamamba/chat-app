import chalk from "chalk";

export class Colors {
  constructor() {
    this.userColors = [
      chalk.cyan,
      chalk.magenta,
      chalk.yellow,
      chalk.green,
      chalk.blue,
      chalk.red,
      chalk.white,
      chalk.gray,
    ];

    this.userColorMap = new Map();
    this.colorIndex = 0;
  }

  getUserColor(username) {
    if (!this.userColorMap.has(username)) {
      const color = this.userColors[this.colorIndex % this.userColors.length];
      this.userColorMap.set(username, color);
      this.colorIndex++;
    }

    return this.userColorMap.get(username);
  }

  formatUsername(username) {
    const color = this.getUserColor(username);
    return color(username);
  }

  formatMessage(message) {
    const { username, content, timestamp } = message;
    const time = this.formatTime(timestamp);
    const user = this.formatUsername(username);

    return `[${chalk.gray(time)}] ${user}: ${content}`;
  }

  formatSystemMessage(content, timestamp) {
    const time = this.formatTime(timestamp);
    return `[${chalk.gray(time)}] ${chalk.yellow("System")}: ${chalk.italic(
      content
    )}`;
  }

  formatNotification(content, timestamp) {
    const time = this.formatTime(timestamp);
    return `[${chalk.gray(time)}] ${chalk.green(content)}`;
  }

  formatError(content, timestamp) {
    const time = this.formatTime(timestamp);
    return `[${chalk.gray(time)}] ${chalk.red("Error")}: ${content}`;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  reset() {
    this.userColorMap.clear();
    this.colorIndex = 0;
  }
}

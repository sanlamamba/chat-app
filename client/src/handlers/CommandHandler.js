export class CommandHandler {
  constructor(wsClient, state, display) {
    this.wsClient = wsClient;
    this.state = state;
    this.display = display;
  }

  handle(command, args = []) {
    switch (command.toLowerCase()) {
      case 'rooms':
        return this.handleRoomsCommand(args);
      case 'users':
        return this.handleUsersCommand(args);
      case 'leave':
        return this.handleLeaveCommand();
      case 'join':
        return this.handleJoinCommand(args);
      case 'create':
        return this.handleCreateCommand(args);
      case 'clear':
        return this.handleClearCommand();
      case 'help':
        return this.handleHelpCommand();
      case 'stats':
        return this.handleStatsCommand();
      case 'me':
        return this.handleMeCommand();
      case 'exit':
      case 'quit':
        return this.handleExitCommand();
      default:
        this.display.error(`Unknown command: /${command}`);
        return false;
    }
  }

  handleRoomsCommand(args) {
    this.wsClient.send({
      type: 'command',
      command: 'rooms',
      args
    });
    return true;
  }

  handleUsersCommand(args) {
    this.wsClient.send({
      type: 'command',
      command: 'users',
      args
    });
    return true;
  }

  handleLeaveCommand() {
    const currentRoom = this.state.getCurrentRoom();

    if (!currentRoom) {
      this.display.error('You are not in a room');
      return false;
    }

    this.wsClient.send({
      type: 'leave_room'
    });

    return true;
  }

  handleJoinCommand(args) {
    if (args.length === 0) {
      this.display.error('Usage: /join <room_name>');
      return false;
    }

    const roomName = args.join(' ');

    this.wsClient.send({
      type: 'join_room',
      roomName
    });

    return true;
  }

  handleCreateCommand(args) {
    if (args.length === 0) {
      this.display.error('Usage: /create <room_name>');
      return false;
    }

    const roomName = args.join(' ');

    this.wsClient.send({
      type: 'create_room',
      roomName
    });

    return true;
  }

  handleClearCommand() {
    this.display.clear();
    return true;
  }

  handleHelpCommand() {
    this.display.showHelp();
    return true;
  }

  handleStatsCommand() {
    this.wsClient.send({
      type: 'command',
      command: 'stats'
    });
    return true;
  }

  handleMeCommand() {
    const username = this.state.getUsername();
    const userId = this.state.getUserId();
    const currentRoom = this.state.getCurrentRoom();

    this.display.info(`Username: ${username}`);
    this.display.info(`User ID: ${userId}`);
    this.display.info(
      `Current Room: ${currentRoom ? currentRoom.name : 'None'}`
    );

    return true;
  }

  handleExitCommand() {
    process.exit(0);
  }
}

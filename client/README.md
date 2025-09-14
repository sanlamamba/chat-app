# Chat Client

Terminal-based real-time chat client with rich UI and automatic reconnection.

## Features

- Real-time messaging with WebSocket connection
- Interactive terminal interface with colors and formatting
- Room creation and joining with commands
- Message history and user presence indicators
- Typing indicators and status updates
- Automatic reconnection with exponential backoff
- Command system for chat operations

## Architecture

```
┌─────────────────┐
│   Chat Client   │
└─────────┬───────┘
          │
┌─────────▼───────┐   ┌─────────────────┐   ┌─────────────────┐
│ WebSocket       │──→│ Message         │──→│ Display         │
│ Client          │   │ Handler         │   │ Manager         │
└─────────────────┘   └─────────┬───────┘   └─────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌─────────────┐     ┌─────────────┐       ┌─────────────┐
  │ State       │     │ Command     │       │ Input       │
  │ Manager     │     │ Handler     │       │ Manager     │
  └─────────────┘     └─────────────┘       └─────────────┘
```

## Project Structure

```
src/
├── index.js                 # Application entry point
├── core/
│   ├── ChatClient.js        # Main client controller
│   └── WebSocketClient.js   # WebSocket connection
├── handlers/
│   ├── MessageHandler.js    # Message processing
│   └── CommandHandler.js    # Command execution
├── services/
│   └── StateManager.js      # Application state
├── ui/
│   ├── Display.js          # Terminal output formatting
│   ├── InputManager.js     # User input handling
│   └── Prompt.js           # Interactive prompts
└── utils/
    └── logger.js           # Client logging
```

## Installation

```bash
npm install
```

## Configuration

Create `.env` file:

```env
SERVER_URL=ws://localhost:3000
LOG_LEVEL=info
```

## Usage

### Start Client

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Interface

### Main Menu

After authentication, use commands:

- `/create` - Create a new chat room
- `/join` - Join an existing room
- `/list` - List available rooms
- `/exit` - Exit application

### Chat Commands

When in a room:

- `/leave` - Leave current room
- `/users` - List users in room
- `/rooms` - List all available rooms
- `/help` - Show available commands
- Type messages directly to send

### UI Features

**Message Display:**

```
[14:30:25] john_doe: Hello everyone!
[14:30:26] System: jane_smith joined the room
[14:30:28] jane_smith: Hi there!
```

**Status Indicators:**

- User join/leave notifications
- Typing indicators
- Connection status
- Room information

**Interactive Elements:**

- Username prompt with validation
- Room name input with autocomplete
- Command suggestions
- Error messages with context

## Key Components

### ChatClient

Main application controller that orchestrates connection, authentication, and user interface.

### WebSocketClient

Handles WebSocket connection with automatic reconnection and event management.

### MessageHandler

Processes incoming messages and updates the display appropriately.

### Display

Manages terminal output with colors, formatting, and structured message display.

### StateManager

Maintains application state including user info, current room, and connection status.

### InputManager

Handles user input with command parsing and validation.

## Connection Management

### Authentication Flow

1. Prompt for username
2. Connect to WebSocket server
3. Send authentication message
4. Handle success/error responses

### Reconnection Strategy

- Automatic reconnection on connection loss
- Exponential backoff (1s, 2s, 4s, 8s, 10s max)
- Maximum 5 reconnection attempts
- Graceful degradation on failure

### Error Handling

- Network connection errors
- Authentication failures
- Invalid commands
- Rate limiting responses

## Commands

### Room Operations

- **Create Room**: `/create room-name`
- **Join Room**: `/join room-name`
- **Leave Room**: `/leave`
- **List Rooms**: `/rooms`

### User Operations

- **List Users**: `/users`
- **Help**: `/help`
- **Exit**: `/exit`

### Message Features

- Send messages by typing (no command prefix)
- Typing indicators when composing messages
- Message history on room join
- Real-time message delivery

## Development Features

### Logging

Structured logging with different levels for debugging and monitoring.

### Validation

- Username format validation
- Room name validation
- Command syntax checking
- Input sanitization

### State Persistence

- Current room tracking
- User session information
- Connection state management

## Terminal Requirements

- Node.js 18.0.0+
- Terminal with color support
- UTF-8 encoding support
- Minimum 80x24 terminal size

## Troubleshooting

**Connection Issues:**

- Verify server is running
- Check WebSocket URL configuration
- Ensure firewall allows connections

**Display Issues:**

- Ensure terminal supports colors
- Check terminal encoding (UTF-8)
- Verify terminal size requirements

**Input Issues:**

- Check keyboard layout
- Verify Node.js version compatibility
- Test terminal input handling

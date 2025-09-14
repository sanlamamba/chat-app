# Real-Time Chat Application

A production-ready real-time chat application with WebSocket server and CLI client.

## Overview

This chat application consists of two main components:

- **Server**: WebSocket-based messaging server with MongoDB and Redis
- **Client**: Terminal-based chat interface with real-time features

## Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Chat Client   │◄────────────────►│   Chat Server   │
│   (Terminal)    │                  │   (Node.js)     │
└─────────────────┘                  └─────┬───────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                         ▼                   ▼                   ▼
                ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                │    MongoDB      │ │     Redis       │ │ HTTP Monitoring │
                │   (Messages)    │ │  (Cache/PubSub) │ │   (Health)      │
                └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Core Features

- Real-time messaging with WebSocket connections
- Room-based chat with creation and joining
- User authentication and presence tracking
- Message persistence and history
- Typing indicators and user status
- Rate limiting and performance monitoring

## Technology Stack

- **Node.js 18+** with WebSocket (ws) library
- **MongoDB** with Mongoose for data persistence
- **Redis** for caching and pub/sub messaging
- **Terminal UI** with Chalk and Inquirer.js

## Getting Started

### Prerequisites

- **Node.js 18.0.0+** - [Download here](https://nodejs.org/)
- **Docker & Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **Git** - For cloning the repository

### Complete Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/sanlamamba/chat-app.git
   cd chat-app
   ```

2. **Start database services**

   ```bash
   docker-compose up -d mongodb redis mongo-express
   ```

   Wait for services to start (about 30 seconds). Verify with:

   ```bash
   docker-compose ps
   ```

3. **Setup and start the server**

   ```bash
   cd server
   npm install
   npm start
   ```

   Server will start on `http://localhost:3000`

4. **Setup and start the client** (open new terminal)

   ```bash
   cd client
   npm install
   npm start
   ```

5. **Start chatting!**
   - Enter your username when prompted
   - Use `/create room-name` to create a room
   - Use `/join room-name` to join existing rooms
   - Type messages to chat

## Components

### Server (`/server`)

Production WebSocket server with MongoDB and Redis integration.
[View Server Documentation](./server/README.md)

### Client (`/client`)

Terminal-based chat client with real-time UI.
[View Client Documentation](./client/README.md)

## Configuration

**Server Environment** (`.env`)

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/realtime-chat
REDIS_URL=redis://localhost:6379
```

**Client Environment** (`.env`)

```env
SERVER_URL=ws://localhost:3000
```

## Development

- **Server dev**: `cd server && npm run dev`
- **Client dev**: `cd client && npm run dev`
- **Tests**: `cd server && npm test`
- **Load test**: `cd server && npm run test:load`

## Monitoring

- Health check: `GET http://localhost:3000/health`
- Metrics: `GET http://localhost:3000/metrics`
- Database admin: `http://localhost:8081` (Mongo Express)

---

For detailed documentation, see component-specific README files.

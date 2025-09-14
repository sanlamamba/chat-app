# Chat Server

Production-ready WebSocket server for real-time chat with MongoDB persistence and Redis caching.

## Features

- WebSocket server with compression and optimization
- MongoDB integration with Mongoose ODM
- Redis caching and pub/sub messaging
- Rate limiting with configurable thresholds
- Circuit breaker pattern for resilience
- Performance monitoring and health checks
- Graceful shutdown and error handling

## Architecture

```
WebSocket Connections
        ↓
┌─────────────────┐
│ Connection      │ ← Rate Limiting
│ Handler         │ ← Authentication
└─────────┬───────┘
          │
┌─────────▼───────┐   ┌─────────────────┐   ┌─────────────────┐
│ Message Handler │──→│ Room Service    │──→│ User Service    │
└─────────────────┘   └─────────┬───────┘   └─────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌─────────────┐     ┌─────────────┐       ┌─────────────┐
  │  MongoDB    │     │   Redis     │       │ Performance │
  │ (Messages,  │     │ (Cache,     │       │ Monitor     │
  │ Users,      │     │ Sessions,   │       │             │
  │ Rooms)      │     │ Pub/Sub)    │       │             │
  └─────────────┘     └─────────────┘       └─────────────┘
```

## Project Structure

```
src/
├── index.js                 # Server entry point
├── config/
│   ├── constants.js         # Application constants
│   ├── database.js          # MongoDB connection
│   └── redis.js            # Redis connection & helpers
├── handlers/
│   ├── ConnectionHandler.js # WebSocket connections
│   ├── MessageHandler.js    # Message processing
│   ├── RoomHandler.js       # Room operations
│   └── CommandHandler.js    # Command processing
├── models/
│   ├── User.js             # User data model
│   ├── Room.js             # Room data model
│   ├── Message.js          # Message data model
│   └── RoomMembership.js   # Room membership model
├── services/
│   ├── UserService.js      # User business logic
│   ├── RoomService.js      # Room business logic
│   └── MessageService.js   # Message business logic
├── middleware/
│   └── RateLimiter.js      # Rate limiting logic
└── utils/
    ├── logger.js           # Winston logging
    ├── circuitBreaker.js   # Circuit breaker pattern
    ├── performanceMonitor.js # Performance metrics
    ├── cacheManager.js     # Cache management
    └── shutdown.js         # Graceful shutdown
```

## Installation

```bash
npm install
```

## Configuration

Create `.env` file:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/realtime-chat
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run unit tests
- `npm run test:coverage` - Run tests with coverage
- `npm run test:load` - Run Artillery load tests
- `npm run lint` - Run ESLint

## API

### WebSocket Messages

**Client → Server:**

- `auth` - Authenticate user
- `join_room` - Join chat room
- `create_room` - Create new room
- `send_message` - Send message
- `typing_start/stop` - Typing indicators

**Server → Client:**

- `auth_success/error` - Authentication result
- `room_joined/created` - Room events
- `message` - New messages
- `user_joined/left` - User presence
- `typing_update` - Typing status

### HTTP Endpoints

- `GET /health` - Health status and metrics
- `GET /metrics` - Detailed performance metrics

## Key Components

### ConnectionHandler

Manages WebSocket connections, authentication, and message routing.

### MessageHandler

Processes chat messages, validates content, and broadcasts to rooms.

### RoomService

Handles room creation, joining, leaving, and member management.

### UserService

Manages user authentication, presence, and profile data.

### Rate Limiting

- Messages: 10/second per user
- Room creation: 5/hour per user
- Commands: 20/minute per user

### Circuit Breaker

Protects against Redis failures with automatic fallback and recovery.

### Performance Monitoring

Real-time metrics collection for requests, latency, memory, and errors.

## Deployment

### Docker

```bash
docker build -t chat-server .
docker run -p 3000:3000 chat-server
```

### Production Environment

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo-cluster:27017/chat
REDIS_URL=redis://redis-cluster:6379
LOG_LEVEL=warn
```

## Monitoring

Health endpoint provides:

- Connection count
- Database status
- Redis circuit breaker state
- Memory usage
- Request metrics

## Testing

Unit tests cover:

- Message handlers
- User service
- Room service
- Data models
- Validation utilities

Load testing with Artillery simulates:

- Concurrent connections
- Message throughput
- Room joining patterns

# 🚀 Real-Time Chat Application with CLI Client

A high-performance, scalable real-time chat application built with Node.js, WebSocket, and MongoDB. Features room management, message persistence, and a beautiful CLI client interface.

## ✨ Features

### Core Features
- **Real-time messaging** with WebSocket communication
- **Multi-room support** with dynamic room creation and management
- **Message persistence** with MongoDB
- **CLI client** with beautiful terminal interface
- **User authentication** with unique IDs
- **Message history** (last 20 messages when joining a room)
- **Typing indicators** (bonus feature)
- **Room and user listing** commands

### Technical Features
- **Horizontal scalability** with Redis Pub/Sub
- **Rate limiting** to prevent abuse
- **Graceful shutdown** and reconnection handling
- **Comprehensive error handling**
- **Docker support** for easy deployment
- **Production-ready** with logging and monitoring

## 🏗️ Architecture

```
┌─────────────┐     WebSocket       ┌─────────────┐
│ CLI Client  │ ◄─────────────────► │   Server    │
└─────────────┘                     └─────────────┘
                                            │
                                    ┌───────┴───────┐
                                    │               │
                                ┌───▼───┐      ┌────▼────┐
                                │MongoDB│      │  Redis  │
                                └───────┘      └─────────┘
```

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 7.0+
- Redis 7.2+ (optional, but recommended)
- Docker & Docker Compose (for containerized deployment)

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd realtime-chat
```

2. **Start all services with Docker Compose**
```bash
docker-compose up -d
```

3. **Run the CLI client**
```bash
cd client
npm install
npm start
```

### Manual Installation

#### 1. Install MongoDB
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

#### 2. Install Redis (Optional)
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Or use Docker
docker run -d -p 6379:6379 --name redis redis:7.2-alpine
```

#### 3. Setup Server
```bash
cd server
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

#### 4. Setup Client
```bash
cd client
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env if needed

# Start the client
npm start
```

## 💻 Usage

### Starting the Client

When you start the client, you'll be prompted to:

1. **Enter your username** - Choose a unique username (2-30 characters)
2. **Choose an action**:
   - Create a new room
   - Join an existing room
   - List available rooms
   - Exit

### Available Commands

Once in a room, you can use these commands:

| Command | Description |
|---------|-------------|
| `/rooms` | List all active rooms |
| `/users` | List users in current room |
| `/leave` | Leave current room |
| `/join <room>` | Join a different room |
| `/create <room>` | Create a new room |
| `/clear` | Clear the screen |
| `/help` | Show help message |
| `/stats` | Show statistics |
| `/me` | Show your user info |
| `/exit` | Exit the application |

### Sending Messages

Simply type your message and press Enter. Messages are automatically sent to all users in the current room.

## 🔧 Configuration

### Server Configuration (.env)

```env
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
MONGODB_URI=mongodb://localhost:27017/realtime-chat
DB_POOL_SIZE=10

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_MESSAGES_PER_SECOND=10
RATE_LIMIT_ROOMS_PER_HOUR=5
```

### Client Configuration (.env)

```env
# Server connection
SERVER_URL=ws://localhost:3000

# Logging
LOG_LEVEL=info
LOG_TO_FILE=false
```

## 🏃 Running Tests

### Server Tests
```bash
cd server
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
```

### Load Testing
```bash
cd server
npm run test:load       # Run load tests with Artillery
```

## 📊 Performance

The application is designed to handle:

- **10,000+ concurrent connections**
- **< 100ms message latency (P95)**
- **Horizontal scaling** with multiple server instances
- **Automatic reconnection** with exponential backoff

## 🐳 Docker Deployment

### Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f server

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Production Deployment

For production, consider:

1. **Use environment-specific configs**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

2. **Enable SSL/TLS** for WebSocket connections
3. **Setup reverse proxy** (Nginx/Traefik)
4. **Configure monitoring** (Prometheus/Grafana)
5. **Setup log aggregation** (ELK Stack)

## 🔍 Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

### Metrics Endpoint
```bash
curl http://localhost:3000/metrics
```

## 🛠️ Development

### Project Structure
```
realtime-chat/
├── server/
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── models/       # MongoDB models
│   │   ├── services/     # Business logic
│   │   ├── handlers/     # WebSocket handlers
│   │   ├── middleware/   # Express middleware
│   │   ├── utils/        # Utility functions
│   │   └── index.js      # Entry point
│   └── package.json
├── client/
│   ├── src/
│   │   ├── core/         # Core client logic
│   │   ├── handlers/     # Message handlers
│   │   ├── ui/           # CLI interface
│   │   ├── services/     # Client services
│   │   ├── utils/        # Utilities
│   │   └── index.js      # Entry point
│   └── package.json
├── docker-compose.yml
└── README.md
```

### Adding New Features

1. **Server-side**: Add handler in `server/src/handlers/`
2. **Client-side**: Add handler in `client/src/handlers/`
3. **Update message types** in `server/src/config/constants.js`
4. **Add tests** for new features

## 🐛 Troubleshooting

### Common Issues

**Connection refused**
- Check if server is running: `lsof -i :3000`
- Verify MongoDB is running: `mongosh --eval "db.version()"`
- Check firewall settings

**Authentication failed**
- Username might be taken
- Check server logs: `docker-compose logs server`

**Messages not persisting**
- Verify MongoDB connection
- Check disk space
- Review MongoDB logs

**High latency**
- Check network connection
- Monitor server resources
- Consider enabling Redis cache

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 👥 Authors

- **Your Name** - *Initial work*

## 🙏 Acknowledgments

- Built for Zaion technical test
- Inspired by modern chat applications
- Thanks to the Node.js and MongoDB communities

## 📞 Support

For support, email support@example.com or open an issue in the repository.

---

**Built with ❤️ using Node.js, WebSocket, and MongoDB**
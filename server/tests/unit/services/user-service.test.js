import { UserService } from '../../../src/services/UserService.js';
import { User } from '../../../src/models/User.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../../src/config/redis.js', () => ({
  RedisHelper: {
    setWithTTL: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../../src/utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('UserService', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(() => {
    UserService.activeConnections.clear();
    UserService.userSockets.clear();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('authenticateUser', () => {
    test('creates new user successfully', async () => {
      const username = 'testuser';
      const socketId = 'socket123';

      const result = await UserService.authenticateUser(username, socketId);

      expect(result.success).toBe(true);
      expect(result.user.username).toBe(username);
      expect(result.user.isNew).toBe(true);
      expect(result.user.userId).toBeDefined();

      expect(UserService.activeConnections.get(socketId)).toBeDefined();
      expect(UserService.userSockets.has(result.user.userId)).toBe(true);
    });

    test('handles existing user reconnection', async () => {
      const username = 'existinguser';
      const socketId = 'socket123';

      const firstResult = await UserService.authenticateUser(
        username,
        socketId
      );
      expect(firstResult.success).toBe(true);

      const secondResult = await UserService.authenticateUser(
        username,
        'socket456'
      );

      expect(secondResult.success).toBe(true);
      expect(secondResult.user.username).toBe(username);
      expect(secondResult.user.isNew).toBe(false);
    });

    test('rejects invalid username', async () => {
      const invalidUsernames = ['', 'a', 'user@name'];

      for (const username of invalidUsernames) {
        const result = await UserService.authenticateUser(
          username,
          'socket123'
        );
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('disconnectUser', () => {
    test('disconnects user and marks offline', async () => {
      const username = 'testuser';
      const socketId = 'socket123';

      const authResult = await UserService.authenticateUser(username, socketId);
      expect(authResult.success).toBe(true);

      const disconnectResult = await UserService.disconnectUser(socketId);

      expect(disconnectResult.success).toBe(true);
      expect(UserService.activeConnections.has(socketId)).toBe(false);
    });

    test('handles disconnection of non-existent socket', async () => {
      const result = await UserService.disconnectUser('nonexistent-socket');
      expect(result.success).toBe(true);
    });
  });

  describe('user lookup methods', () => {
    test('getUserIdBySocket returns correct userId', async () => {
      const username = 'testuser';
      const socketId = 'socket123';

      const authResult = await UserService.authenticateUser(username, socketId);
      const userId = UserService.getUserIdBySocket(socketId);

      expect(userId).toBe(authResult.user.userId);
    });

    test('getSocketsByUserId returns user sockets', async () => {
      const username = 'testuser';
      const socketId = 'socket123';

      const authResult = await UserService.authenticateUser(username, socketId);
      const sockets = UserService.getSocketsByUserId(authResult.user.userId);

      expect(sockets).toContain(socketId);
    });

    test('getOnlineUsers returns online users list', async () => {
      await UserService.authenticateUser('user1', 'socket1');
      await UserService.authenticateUser('user2', 'socket2');

      const onlineUsers = await UserService.getOnlineUsers();

      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers.every((user) => user.userId && user.username)).toBe(
        true
      );
    });
  });

  describe('metrics', () => {
    test('getMetrics returns connection statistics', async () => {
      await UserService.authenticateUser('user1', 'socket1');
      await UserService.authenticateUser('user2', 'socket2');

      const metrics = UserService.getMetrics();

      expect(metrics.activeConnections).toBe(2);
      expect(metrics.uniqueUsers).toBe(2);
      expect(typeof metrics.multiDeviceUsers).toBe('number');
    });
  });
});

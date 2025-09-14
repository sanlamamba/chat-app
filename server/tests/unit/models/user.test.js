import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../../src/models/User.js";
import { v4 as uuidv4 } from "uuid";

describe("User Model", () => {
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

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe("user creation", () => {
    test("creates user with valid data", async () => {
      const userData = {
        userId: uuidv4(),
        username: "testuser",
      };

      const user = await User.create(userData);

      expect(user.userId).toBe(userData.userId);
      expect(user.username).toBe(userData.username);
      expect(user.isOnline).toBe(false);
      expect(user.metadata.totalMessages).toBe(0);
      expect(user.metadata.connectionCount).toBe(0);
    });

    test("enforces unique userId constraint", async () => {
      const userId = uuidv4();

      await User.create({ userId, username: "user1" });

      await expect(
        User.create({ userId, username: "user2" })
      ).rejects.toThrow();
    });

    test("validates username length", async () => {
      await expect(
        User.create({
          userId: uuidv4(),
          username: "a",
        })
      ).rejects.toThrow();

      await expect(
        User.create({
          userId: uuidv4(),
          username: "a".repeat(31),
        })
      ).rejects.toThrow();
    });
  });

  describe("static methods", () => {
    test("findByUserId returns correct user", async () => {
      const userId = uuidv4();
      await User.create({ userId, username: "testuser" });

      const found = await User.findByUserId(userId);

      expect(found.userId).toBe(userId);
      expect(found.username).toBe("testuser");
    });

    test("findOnlineUsers returns only online users", async () => {
      await User.create({
        userId: uuidv4(),
        username: "online1",
        isOnline: true,
      });
      await User.create({
        userId: uuidv4(),
        username: "online2",
        isOnline: true,
      });
      await User.create({
        userId: uuidv4(),
        username: "offline1",
        isOnline: false,
      });

      const onlineUsers = await User.findOnlineUsers();

      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers.every((user) => user.isOnline)).toBe(true);
    });

    test("setUserOnline updates status and clears room when offline", async () => {
      const userId = uuidv4();
      await User.create({
        userId,
        username: "testuser",
        currentRoom: "general",
        isOnline: true,
      });

      const updatedUser = await User.setUserOnline(userId, false);

      expect(updatedUser.isOnline).toBe(false);
      expect(updatedUser.currentRoom).toBeNull();
    });
  });

  describe("instance methods", () => {
    test("incrementMessageCount increases total messages", async () => {
      const user = await User.create({
        userId: uuidv4(),
        username: "testuser",
      });

      await user.incrementMessageCount();

      expect(user.metadata.totalMessages).toBe(1);
    });

    test("displayName generates correct format", async () => {
      const userId = uuidv4();
      const user = await User.create({
        userId,
        username: "testuser",
      });

      expect(user.displayName).toBe(`testuser#${userId.substring(0, 4)}`);
    });
  });
});

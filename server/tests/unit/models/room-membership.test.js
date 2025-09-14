import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { RoomMembership } from "../../../src/models/RoomMembership.js";
import { v4 as uuidv4 } from "uuid";

describe("RoomMembership Model", () => {
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

  beforeEach(async () => {
    await RoomMembership.deleteMany({});
  });

  describe("Schema", () => {
    test("creates membership with valid data", async () => {
      const data = {
        roomId: "general",
        userId: uuidv4(),
        username: "testuser",
      };

      const membership = await RoomMembership.create(data);

      expect(membership.roomId).toBe(data.roomId);
      expect(membership.userId).toBe(data.userId);
      expect(membership.username).toBe(data.username);
      expect(membership.isActive).toBe(true);
      expect(membership.metadata.messagesInRoom).toBe(0);
    });

    test("enforces required fields", async () => {
      await expect(RoomMembership.create({})).rejects.toThrow();
    });

    test("enforces unique constraint", async () => {
      const data = { roomId: "general", userId: uuidv4(), username: "test" };

      await RoomMembership.create(data);
      await expect(RoomMembership.create(data)).rejects.toThrow();
    });
  });

  describe("Instance Methods", () => {
    let membership;

    beforeEach(async () => {
      membership = await RoomMembership.create({
        roomId: "general",
        userId: uuidv4(),
        username: "testuser",
      });
    });

    test("leave() marks as inactive", async () => {
      await membership.leave();

      expect(membership.isActive).toBe(false);
      expect(membership.leftAt).toBeInstanceOf(Date);
    });

    test("rejoin() reactivates membership", async () => {
      await membership.leave();
      await membership.rejoin();

      expect(membership.isActive).toBe(true);
      expect(membership.leftAt).toBeNull();
      expect(membership.metadata.joinCount).toBe(2);
    });

    test("incrementMessageCount() updates count", async () => {
      await membership.incrementMessageCount();

      expect(membership.metadata.messagesInRoom).toBe(1);
      expect(membership.metadata.lastMessageAt).toBeInstanceOf(Date);
    });
  });

  describe("Static Methods", () => {
    test("joinRoom() creates new membership", async () => {
      const userId = uuidv4();
      const membership = await RoomMembership.joinRoom(
        userId,
        "testuser",
        "general"
      );

      expect(membership.userId).toBe(userId);
      expect(membership.isActive).toBe(true);
    });

    test("joinRoom() reactivates inactive membership", async () => {
      const userId = uuidv4();
      const first = await RoomMembership.joinRoom(
        userId,
        "testuser",
        "general"
      );
      await first.leave();

      const second = await RoomMembership.joinRoom(
        userId,
        "testuser",
        "general"
      );

      expect(second._id.toString()).toBe(first._id.toString());
      expect(second.isActive).toBe(true);
    });

    test("leaveRoom() marks membership inactive", async () => {
      const userId = uuidv4();
      await RoomMembership.joinRoom(userId, "testuser", "general");

      const result = await RoomMembership.leaveRoom(userId, "general");

      expect(result.isActive).toBe(false);
    });

    test("getActiveRoomMembers() returns active members", async () => {
      const user1 = uuidv4();
      const user2 = uuidv4();

      await RoomMembership.joinRoom(user1, "user1", "general");
      const inactive = await RoomMembership.joinRoom(user2, "user2", "general");
      await inactive.leave();

      const members = await RoomMembership.getActiveRoomMembers("general");

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(user1);
    });

    test("getUserActiveRooms() returns user's active rooms", async () => {
      const userId = uuidv4();

      await RoomMembership.joinRoom(userId, "testuser", "general");
      const inactive = await RoomMembership.joinRoom(
        userId,
        "testuser",
        "tech"
      );
      await inactive.leave();

      const rooms = await RoomMembership.getUserActiveRooms(userId);

      expect(rooms).toHaveLength(1);
      expect(rooms[0].roomId).toBe("general");
    });

    test("getRoomMemberCount() returns correct count", async () => {
      await RoomMembership.joinRoom(uuidv4(), "user1", "general");
      await RoomMembership.joinRoom(uuidv4(), "user2", "general");

      const count = await RoomMembership.getRoomMemberCount("general");

      expect(count).toBe(2);
    });

    test("cleanupInactiveMemberships() removes old inactive memberships", async () => {
      const membership = await RoomMembership.joinRoom(
        uuidv4(),
        "testuser",
        "general"
      );
      await membership.leave();

      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await RoomMembership.findByIdAndUpdate(membership._id, {
        leftAt: oldDate,
      });

      const result = await RoomMembership.cleanupInactiveMemberships();

      expect(result.deletedCount).toBe(1);
    });
  });
});

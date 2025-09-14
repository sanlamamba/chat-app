import mongoose from "mongoose";
import logger from "../utils/logger.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/realtime-chat";
const MAX_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || "10");

export async function connectDatabase() {
  try {
    mongoose.set("strictQuery", false);

    mongoose.connection.on("connected", () => {
      logger.info("MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: MAX_POOL_SIZE,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
    });

    await createIndexes();

    logger.info(`MongoDB connected to ${MONGODB_URI}`);
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    throw error;
  }
}

async function createIndexes() {
  try {
    const db = mongoose.connection.db;

    await db.collection("messages").createIndex({ roomId: 1, timestamp: -1 });
    await db.collection("messages").createIndex(
      { timestamp: 1 },
      {
        expireAfterSeconds: 30 * 24 * 60 * 60,
      }
    );

    await db.collection("rooms").createIndex({ name: 1 }, { unique: true });
    await db.collection("rooms").createIndex({ createdAt: -1 });
    await db.collection("rooms").createIndex({ isActive: 1 });

    await db.collection("users").createIndex({ userId: 1 }, { unique: true });
    await db.collection("users").createIndex({ username: 1 });
    await db.collection("users").createIndex({ lastSeen: 1 });

    await db
      .collection("roommemberships")
      .createIndex({ roomId: 1, userId: 1 });
    await db
      .collection("roommemberships")
      .createIndex({ userId: 1, isActive: 1 });

    logger.info("Database indexes created successfully");
  } catch (error) {
    logger.warn("Error creating indexes:", error.message);
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected gracefully");
  } catch (error) {
    logger.error("Error disconnecting MongoDB:", error);
  }
}

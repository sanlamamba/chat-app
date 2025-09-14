import { disconnectDatabase } from "../config/database.js";
import { disconnectRedis } from "../config/redis.js";
import { RoomService } from "../services/RoomService.js";
import { MessageService } from "../services/MessageService.js";
import { UserService } from "../services/UserService.js";
import logger from "./logger.js";

export async function gracefulShutdown() {
  try {
    logger.info("Starting graceful shutdown...");

    await Promise.all([
      RoomService.cleanup(),
      MessageService.cleanup(),
      UserService.cleanup(),
    ]);

    await disconnectDatabase();
    await disconnectRedis();

    logger.info("Cleanup completed successfully");
  } catch (error) {
    logger.error("Error during shutdown:", error);
  }
}

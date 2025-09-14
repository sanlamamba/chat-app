import WebSocket from "ws";
import EventEmitter from "events";
import logger from "../utils/logger.js";

export class WebSocketClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.heartbeatInterval = null;
    this.messageQueue = [];
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        this.isConnected = true;
        this.emit("open");
        this.startHeartbeat();
        this.flushMessageQueue();
        logger.info("WebSocket connected");
      });

      this.ws.on("message", (data) => {
        this.emit("message", data.toString());
        logger.debug("Received:", data.toString());
      });

      this.ws.on("close", (code, reason) => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit("close", code, reason);
        logger.info(`WebSocket closed: ${code} - ${reason}`);
      });

      this.ws.on("error", (error) => {
        this.emit("error", error);
        logger.error("WebSocket error:", error);
      });

      this.ws.on("ping", () => {
        this.ws.pong();
      });
    } catch (error) {
      logger.error("Failed to connect:", error);
      this.emit("error", error);
    }
  }

  send(data) {
    const message = typeof data === "string" ? data : JSON.stringify(data);

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      logger.debug("Sent:", message);
    } else {
      this.messageQueue.push(message);
      logger.debug("Queued message:", message);
    }
  }

  close(code = 1000, reason = "Client closing") {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close(code, reason);
      this.isConnected = false;
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.ws.send(message);
      logger.debug("Sent queued message:", message);
    }
  }

  getState() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : null,
      queuedMessages: this.messageQueue.length,
    };
  }
}

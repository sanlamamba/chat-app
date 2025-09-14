import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';
import { CONSTANTS } from '../config/constants.js';

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.userSessions = new Map();
    this.cleanup();
  }

  createSession(userId, username, connectionId, metadata = {}) {
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId,
      username,
      connectionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      metadata: {
        userAgent: metadata.userAgent,
        ip: metadata.ip,
        ...metadata
      }
    };

    this.sessions.set(sessionId, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(sessionId);

    logger.debug('Session created', {
      service: 'session',
      sessionId,
      userId,
      username
    });

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((session) => session && session.isActive);
  }

  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      return true;
    }
    return false;
  }

  invalidateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isActive = false;
    this.sessions.delete(sessionId);

    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    logger.debug('Session invalidated', {
      service: 'session',
      sessionId,
      userId: session.userId
    });

    return true;
  }

  invalidateUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId) || new Set();
    let invalidatedCount = 0;

    sessionIds.forEach((sessionId) => {
      if (this.invalidateSession(sessionId)) {
        invalidatedCount++;
      }
    });

    logger.info('User sessions invalidated', {
      service: 'session',
      userId,
      count: invalidatedCount
    });

    return invalidatedCount;
  }

  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return { valid: false, reason: 'Session not found or inactive' };
    }

    const now = new Date();
    const maxAge = CONSTANTS.CONNECTION_TIMEOUT;
    const age = now - session.lastActivity;

    if (age > maxAge) {
      this.invalidateSession(sessionId);
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true, session };
  }

  getActiveSessionsCount() {
    return this.sessions.size;
  }

  getSessionStats() {
    const now = new Date();
    let activeSessions = 0;
    let expiredSessions = 0;
    const userCounts = {};

    this.sessions.forEach((session) => {
      const age = now - session.lastActivity;
      if (age > CONSTANTS.CONNECTION_TIMEOUT) {
        expiredSessions++;
      } else {
        activeSessions++;
        userCounts[session.userId] = (userCounts[session.userId] || 0) + 1;
      }
    });

    return {
      total: this.sessions.size,
      active: activeSessions,
      expired: expiredSessions,
      uniqueUsers: Object.keys(userCounts).length,
      multiSessionUsers: Object.values(userCounts).filter((count) => count > 1)
        .length
    };
  }

  cleanup() {
    setInterval(() => {
      const now = new Date();
      const expiredSessions = [];

      this.sessions.forEach((session, sessionId) => {
        const age = now - session.lastActivity;
        if (age > CONSTANTS.CONNECTION_TIMEOUT) {
          expiredSessions.push(sessionId);
        }
      });

      expiredSessions.forEach((sessionId) => {
        this.invalidateSession(sessionId);
      });

      if (expiredSessions.length > 0) {
        logger.info('Cleaned up expired sessions', {
          service: 'session',
          count: expiredSessions.length
        });
      }
    }, 5 * 60 * 1000);
  }
}

export const sessionManager = new SessionManager();

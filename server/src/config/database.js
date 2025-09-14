import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime-chat';
const MAX_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '10', 10);

export async function connectDatabase() {
  const startTime = Date.now();

  try {
    mongoose.set('strictQuery', false);

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established', { service: 'database' });
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', {
        service: 'database',
        error: err.message
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected', { service: 'database' });
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected', { service: 'database' });
    });

    logger.info('Connecting to MongoDB', {
      service: 'database',
      uri: MONGODB_URI.replace(/\/\/.*@/, '//***:***@'),
      poolSize: MAX_POOL_SIZE
    });

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: MAX_POOL_SIZE,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
      bufferCommands: false,
      maxIdleTimeMS: 30000,
      retryWrites: true
    });

    await ensureIndexes();

    const duration = Date.now() - startTime;
    logger.info('Database connection successful', {
      service: 'database',
      duration,
      readyState: mongoose.connection.readyState
    });
  } catch (error) {
    logger.error('MongoDB connection failed', {
      service: 'database',
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}

async function ensureIndexes() {
  const startTime = Date.now();

  try {
    logger.info('Creating database indexes', {
      service: 'database',
      action: 'index_creation'
    });

    const { User } = await import('../models/User.js');
    const { Room } = await import('../models/Room.js');
    const { Message } = await import('../models/Message.js');
    const { RoomMembership } = await import('../models/RoomMembership.js');

    await Promise.all([
      User.init(),
      Room.init(),
      Message.init(),
      RoomMembership.init()
    ]);

    const duration = Date.now() - startTime;
    logger.info('Database indexes created successfully', {
      service: 'database',
      duration,
      action: 'index_creation'
    });

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    logger.debug('Database collections initialized', {
      service: 'database',
      collections: collections.map((c) => c.name)
    });
  } catch (error) {
    logger.error('Error creating indexes', {
      service: 'database',
      error: error.message,
      duration: Date.now() - startTime,
      action: 'index_creation'
    });
  }
}

export async function disconnectDatabase() {
  try {
    logger.info('Disconnecting from MongoDB', { service: 'database' });
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully', { service: 'database' });
  } catch (error) {
    logger.error('Error disconnecting MongoDB', {
      service: 'database',
      error: error.message
    });
  }
}

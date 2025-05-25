// File: backend/src/config/db.js
// Database connection configuration - Updated with better error handling and fallback

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Check if MongoDB URI is provided
    if (!process.env.MONGODB_URI) {
      logger.warn('MONGODB_URI not found in environment variables');
      logger.info('Falling back to file-based storage...');
      return { connected: false, storage: 'file-based' };
    }

    // Set mongoose connection options
    const options = {
      // Connection timeout (30 seconds)
      serverSelectionTimeoutMS: 30000,
      // Keep trying to reconnect
      maxPoolSize: 10,
      // Close connections after 30 seconds of inactivity
      maxIdleTimeMS: 30000,
      // Use new connection management
      family: 4 // Use IPv4, skip trying IPv6
    };

    logger.info('Attempting to connect to MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    logger.info(`✅ MongoDB Connected Successfully!`);
    logger.info(`📍 Host: ${conn.connection.host}`);
    logger.info(`🗄️  Database: ${conn.connection.name}`);
    logger.info(`🔗 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting'}`);
    
    // Listen for connection events
    mongoose.connection.on('connected', () => {
      logger.info('🟢 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`🔴 Mongoose connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('🟡 Mongoose disconnected from MongoDB');
    });

    // Handle app termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('🔒 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        logger.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

    return { connected: true, storage: 'mongodb', connection: conn };

  } catch (error) {
    // Enhanced error logging
    logger.error(`❌ Failed to connect to MongoDB:`);
    logger.error(`   Error: ${error.message}`);
    logger.error(`   Code: ${error.code || 'Unknown'}`);
    
    // Check for common connection issues
    if (error.message.includes('ENOTFOUND')) {
      logger.error('   Issue: DNS resolution failed - check your MongoDB URI');
    } else if (error.message.includes('ECONNREFUSED')) {
      logger.error('   Issue: Connection refused - MongoDB server might be down');
    } else if (error.message.includes('authentication failed')) {
      logger.error('   Issue: Authentication failed - check username/password');
    } else if (error.message.includes('timeout')) {
      logger.error('   Issue: Connection timeout - check network connectivity');
    }
    
    logger.warn('🔄 Falling back to file-based storage...');
    logger.info('💡 To use MongoDB, ensure MONGODB_URI is set correctly in your .env file');
    
    // Don't exit the process, let the app continue with file storage
    return { connected: false, storage: 'file-based', error: error.message };
  }
};

// Function to check if MongoDB is connected
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Function to get connection status
const getConnectionStatus = () => {
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  return {
    state: mongoose.connection.readyState,
    status: states[mongoose.connection.readyState] || 'Unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };
};

// Function to gracefully disconnect
const disconnect = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('🔒 MongoDB connection closed gracefully');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    return false;
  }
};

module.exports = {
  connectDB,
  isConnected,
  getConnectionStatus,
  disconnect
};
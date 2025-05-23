// File: backend/middlewares/authMiddleware.js
// Authentication middleware

const jwt = require('jsonwebtoken');
const { ErrorResponse } = require('./errorMiddleware');
const User = require('../models/userModel');
const logger = require('../utils/logger');

// Protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return next(new ErrorResponse('User not found', 404));
      }

      next();
    } catch (error) {
      logger.error(`JWT verification error: ${error.message}`);
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return next(new ErrorResponse('Authentication error', 500));
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

module.exports = { protect, authorize };


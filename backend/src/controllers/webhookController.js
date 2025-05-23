// File: backend/controllers/webhookController.js
// Webhook controller for handling incoming messages from 1CONFIRMED

const { ErrorResponse } = require('../src/services/middlewares/errorMiddleware');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');

// @desc    Handle incoming message webhook from 1CONFIRMED
// @route   POST /api/webhooks/whatsapp
// @access  Public
exports.handleWhatsAppWebhook = async (req, res, next) => {
  try {
    logger.info(`Received webhook: ${JSON.stringify(req.body)}`);
    
    // Validate the webhook payload
    const payload = req.body;
    
    if (!payload) {
      return next(new ErrorResponse('Invalid webhook payload', 400));
    }
    
    // Process the message in the background
    // We respond to the webhook immediately to prevent timeouts
    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
    
    // Process the message asynchronously
    try {
      await whatsappService.processIncomingMessage(payload);
    } catch (error) {
      logger.error(`Error processing webhook: ${error.message}`);
    }
  } catch (error) {
    logger.error(`Webhook handling error: ${error.message}`);
    next(error);
  }
};

// @desc    Handle webhook verification from 1CONFIRMED
// @route   GET /api/webhooks/whatsapp
// @access  Public
exports.verifyWebhook = (req, res) => {
  // 1CONFIRMED may send a verification token to validate the webhook URL
  const verificationToken = req.query.token || req.query.hub_verify_token;
  
  if (verificationToken === process.env.WEBHOOK_VERIFY_TOKEN) {
    const challenge = req.query.challenge || req.query.hub_challenge;
    
    if (challenge) {
      return res.status(200).send(challenge);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Webhook verified'
    });
  }
  
  return res.status(403).json({
    success: false,
    message: 'Verification failed'
  });
};
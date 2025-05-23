// File: backend/controllers/messageController.js
// Message controller for managing message templates and history

const MessageTemplate = require('../models/messageTemplateModel');
const Message = require('../models/messageModel');
const { ErrorResponse } = require('../middlewares/errorMiddleware');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');

// @desc    Get all message templates
// @route   GET /api/messages/templates
// @access  Private
exports.getMessageTemplates = async (req, res, next) => {
  try {
    const templates = await MessageTemplate.find()
      .sort('name')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    logger.error(`Get message templates error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single message template
// @route   GET /api/messages/templates/:id
// @access  Private
exports.getMessageTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!template) {
      return next(
        new ErrorResponse(`Message template not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Get message template error: ${error.message}`);
    next(error);
  }
};

// @desc    Create new message template
// @route   POST /api/messages/templates
// @access  Private
exports.createMessageTemplate = async (req, res, next) => {
  try {
    // Add user as template creator
    req.body.createdBy = req.user.id;

    const template = await MessageTemplate.create(req.body);

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Create message template error: ${error.message}`);
    next(error);
  }
};

// @desc    Update message template
// @route   PUT /api/messages/templates/:id
// @access  Private
exports.updateMessageTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!template) {
      return next(
        new ErrorResponse(`Message template not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Update message template error: ${error.message}`);
    next(error);
  }
};

// @desc    Delete message template
// @route   DELETE /api/messages/templates/:id
// @access  Private
exports.deleteMessageTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findById(req.params.id);

    if (!template) {
      return next(
        new ErrorResponse(`Message template not found with id of ${req.params.id}`, 404)
      );
    }

    await template.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Delete message template error: ${error.message}`);
    next(error);
  }
};

// @desc    Get message history
// @route   GET /api/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Remove excluded fields from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    query = Message.find(JSON.parse(queryStr))
      .populate('patient', 'name phoneNumber')
      .populate('appointment')
      .populate('messageTemplate', 'name type');

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Message.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const messages = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: messages.length,
      pagination,
      total,
      data: messages
    });
  } catch (error) {
    logger.error(`Get messages error: ${error.message}`);
    next(error);
  }
};

// @desc    Get message by patient
// @route   GET /api/messages/patient/:patientId
// @access  Private
exports.getPatientMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ patient: req.params.patientId })
      .populate('appointment')
      .populate('messageTemplate', 'name type')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    logger.error(`Get patient messages error: ${error.message}`);
    next(error);
  }
};

// @desc    Get conversation for an appointment
// @route   GET /api/messages/appointment/:appointmentId
// @access  Private
exports.getAppointmentMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ appointment: req.params.appointmentId })
      .populate('patient', 'name phoneNumber')
      .populate('messageTemplate', 'name type')
      .sort('createdAt');

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    logger.error(`Get appointment messages error: ${error.message}`);
    next(error);
  }
};

// @desc    Send custom message to patient
// @route   POST /api/messages/send
// @access  Private
exports.sendCustomMessage = async (req, res, next) => {
  try {
    const { patientId, appointmentId, content, useTemplate, templateId } = req.body;

    if (!patientId) {
      return next(new ErrorResponse('Patient ID is required', 400));
    }

    // Find the patient
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return next(new ErrorResponse(`Patient not found with id of ${patientId}`, 404));
    }

    let messageResponse;

    // Send either templated or text message
    if (useTemplate && templateId) {
      // Find the template
      const template = await MessageTemplate.findById(templateId);

      if (!template) {
        return next(new ErrorResponse(`Template not found with id of ${templateId}`, 404));
      }

      // Extract variables from request body
      const variables = req.body.variables || {};

      // Send templated message
      messageResponse = await whatsappService.sendTemplatedMessage(
        patient.getWhatsAppNumber(),
        template.externalTemplateId,
        variables
      );

      // Create message record
      const message = await Message.create({
        patient: patientId,
        appointment: appointmentId,
        direction: 'outbound',
        channel: 'whatsapp',
        messageTemplate: templateId,
        content: template.content,
        variables: variables,
        externalMessageId: messageResponse.id,
        status: 'sent',
        sentAt: new Date()
      });

      res.status(200).json({
        success: true,
        data: message
      });
    } else {
      // Send text message
      if (!content) {
        return next(new ErrorResponse('Message content is required', 400));
      }

      messageResponse = await whatsappService.sendTextMessage(
        patient.getWhatsAppNumber(),
        content
      );

      // Create message record
      const message = await Message.create({
        patient: patientId,
        appointment: appointmentId,
        direction: 'outbound',
        channel: 'whatsapp',
        content: content,
        externalMessageId: messageResponse.id,
        status: 'sent',
        sentAt: new Date()
      });

      res.status(200).json({
        success: true,
        data: message
      });
    }
  } catch (error) {
    logger.error(`Send custom message error: ${error.message}`);
    next(error);
  }
};


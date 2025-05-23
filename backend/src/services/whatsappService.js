// File: backend/services/whatsappService.js
// WhatsApp service integration with 1CONFIRMED API

const axios = require('axios');
const Appointment = require('../models/appointmentModel');
const MessageTemplate = require('../models/messageTemplateModel');
const Message = require('../models/messageModel');
const logger = require('../utils/logger');
const moment = require('moment');

// Configure axios instance for 1CONFIRMED API
const confirmedAPI = axios.create({
  baseURL: process.env.CONFIRMED_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.CONFIRMED_API_KEY}`
  }
});

/**
 * Send a templated WhatsApp message using 1CONFIRMED API
 * @param {string} phoneNumber - Recipient phone number in international format
 * @param {string} templateId - 1CONFIRMED template ID
 * @param {Object} variables - Template variables
 * @returns {Promise<Object>} - API response
 */
const sendTemplatedMessage = async (phoneNumber, templateId, variables) => {
  try {
    // Make sure phone number is in correct format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Remove any spaces from the phone number
    phoneNumber = phoneNumber.replace(/\s/g, '');

    const response = await confirmedAPI.post('/messages', {
      to: phoneNumber,
      type: 'template',
      template: {
        id: templateId,
        variables: variables
      }
    });

    logger.info(`WhatsApp message sent to ${phoneNumber} using template ${templateId}`);
    
    return response.data;
  } catch (error) {
    logger.error(`Error sending WhatsApp message: ${error.message}`);
    if (error.response) {
      logger.error(`1CONFIRMED API error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

/**
 * Send a text-only WhatsApp message using 1CONFIRMED API
 * @param {string} phoneNumber - Recipient phone number in international format
 * @param {string} text - Message text
 * @returns {Promise<Object>} - API response
 */
const sendTextMessage = async (phoneNumber, text) => {
  try {
    // Make sure phone number is in correct format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Remove any spaces from the phone number
    phoneNumber = phoneNumber.replace(/\s/g, '');

    const response = await confirmedAPI.post('/messages', {
      to: phoneNumber,
      type: 'text',
      text: {
        body: text
      }
    });

    logger.info(`WhatsApp text message sent to ${phoneNumber}`);
    
    return response.data;
  } catch (error) {
    logger.error(`Error sending WhatsApp text message: ${error.message}`);
    if (error.response) {
      logger.error(`1CONFIRMED API error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

/**
 * Send interactive WhatsApp message with buttons
 * @param {string} phoneNumber - Recipient phone number in international format
 * @param {string} text - Message text
 * @param {Array} buttons - Array of button objects
 * @returns {Promise<Object>} - API response
 */
const sendInteractiveMessage = async (phoneNumber, text, buttons) => {
  try {
    // Make sure phone number is in correct format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Remove any spaces from the phone number
    phoneNumber = phoneNumber.replace(/\s/g, '');

    const response = await confirmedAPI.post('/messages', {
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: text
        },
        action: {
          buttons: buttons
        }
      }
    });

    logger.info(`WhatsApp interactive message sent to ${phoneNumber}`);
    
    return response.data;
  } catch (error) {
    logger.error(`Error sending WhatsApp interactive message: ${error.message}`);
    if (error.response) {
      logger.error(`1CONFIRMED API error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

/**
 * Send appointment reminder via WhatsApp
 * @param {string} appointmentId - Appointment ID
 * @param {string} templateId - Optional template ID, will use default if not provided
 * @returns {Promise<Object>} - Message record
 */
const sendAppointmentReminder = async (appointmentId, templateId) => {
  try {
    // Fetch appointment with populated relationships
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient')
      .populate('doctor')
      .populate('department');

    if (!appointment) {
      throw new Error(`Appointment not found with id: ${appointmentId}`);
    }

    // Get patient phone number
    const phoneNumber = appointment.patient.getWhatsAppNumber();

    // Find template to use (either specified or default)
    let messageTemplate;
    
    if (templateId) {
      messageTemplate = await MessageTemplate.findById(templateId);
    } else {
      messageTemplate = await MessageTemplate.findOne({
        type: 'appointment_reminder',
        isActive: true
      });
    }

    if (!messageTemplate) {
      throw new Error('No active appointment reminder template found');
    }

    // Prepare variables for template
    const appointmentDate = moment(appointment.date).format('dddd, MMMM D, YYYY');
    const appointmentTime = `${appointment.startTime} - ${appointment.endTime}`;
    const doctorName = appointment.doctor.name;
    const departmentName = appointment.department.name;
    const locationStr = `${appointment.location.building || ''}, Floor ${appointment.location.floor || ''}, Room ${appointment.location.roomNumber || ''}`;
    
    const variables = {
      patient_name: appointment.patient.name,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      doctor_name: doctorName,
      department: departmentName,
      location: locationStr,
      preparation: appointment.preparationInstructions || 'No special preparation required.'
    };

    // Send the message
    const messageResponse = await sendTemplatedMessage(
      phoneNumber,
      messageTemplate.externalTemplateId,
      variables
    );

    // Record the message in our database
    const message = await Message.create({
      patient: appointment.patient._id,
      appointment: appointment._id,
      direction: 'outbound',
      channel: 'whatsapp',
      messageTemplate: messageTemplate._id,
      content: messageTemplate.content,
      variables: variables,
      externalMessageId: messageResponse.id,
      status: 'sent',
      sentAt: new Date()
    });

    // Update appointment with reminder info
    const reminderIndex = appointment.reminders.findIndex(
      reminder => reminder.type === 'whatsapp' && !reminder.sent
    );

    if (reminderIndex !== -1) {
      appointment.reminders[reminderIndex].sent = true;
      appointment.reminders[reminderIndex].messageId = message._id;
      appointment.reminders[reminderIndex].status = 'sent';
      await appointment.save();
    }

    return message;
  } catch (error) {
    logger.error(`Error sending appointment reminder: ${error.message}`);
    throw error;
  }
};

/**
 * Send initial appointment notification after booking
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} - Message record
 */
const sendAppointmentNotification = async (appointmentId) => {
  try {
    // Fetch appointment with populated relationships
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient')
      .populate('doctor')
      .populate('department');

    if (!appointment) {
      throw new Error(`Appointment not found with id: ${appointmentId}`);
    }

    // Get patient phone number
    const phoneNumber = appointment.patient.getWhatsAppNumber();

    // Find template for initial notification
    const messageTemplate = await MessageTemplate.findOne({
      type: 'appointment_confirmation',
      isActive: true
    });

    if (!messageTemplate) {
      throw new Error('No active appointment confirmation template found');
    }

    // Prepare variables for template
    const appointmentDate = moment(appointment.date).format('dddd, MMMM D, YYYY');
    const appointmentTime = `${appointment.startTime} - ${appointment.endTime}`;
    const doctorName = appointment.doctor.name;
    const departmentName = appointment.department.name;
    const locationStr = `${appointment.location.building || ''}, Floor ${appointment.location.floor || ''}, Room ${appointment.location.roomNumber || ''}`;
    
    const variables = {
      patient_name: appointment.patient.name,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      doctor_name: doctorName,
      department: departmentName,
      location: locationStr,
      preparation: appointment.preparationInstructions || 'No special preparation required.'
    };

    // Send the message
    const messageResponse = await sendTemplatedMessage(
      phoneNumber,
      messageTemplate.externalTemplateId,
      variables
    );

    // Create interactive buttons for user response
    const buttons = [
      {
        id: 'confirm',
        title: 'Confirm'
      },
      {
        id: 'reschedule',
        title: 'Reschedule'
      },
      {
        id: 'cancel',
        title: 'Cancel'
      }
    ];

    // Send interactive message for confirmation
    const interactiveResponse = await sendInteractiveMessage(
      phoneNumber,
      'Please confirm your appointment:',
      buttons
    );

    // Record the messages in our database
    const notificationMessage = await Message.create({
      patient: appointment.patient._id,
      appointment: appointment._id,
      direction: 'outbound',
      channel: 'whatsapp',
      messageTemplate: messageTemplate._id,
      content: messageTemplate.content,
      variables: variables,
      externalMessageId: messageResponse.id,
      status: 'sent',
      sentAt: new Date()
    });

    const interactiveMessage = await Message.create({
      patient: appointment.patient._id,
      appointment: appointment._id,
      direction: 'outbound',
      channel: 'whatsapp',
      content: 'Please confirm your appointment:',
      externalMessageId: interactiveResponse.id,
      status: 'sent',
      sentAt: new Date()
    });

    return {
      notification: notificationMessage,
      interactive: interactiveMessage
    };
  } catch (error) {
    logger.error(`Error sending appointment notification: ${error.message}`);
    throw error;
  }
};

/**
 * Send appointment update notification (for reschedules or cancellations)
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} - Message record
 */
const sendAppointmentUpdateNotification = async (appointmentId) => {
  try {
    // Fetch appointment with populated relationships
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient')
      .populate('doctor')
      .populate('department');

    if (!appointment) {
      throw new Error(`Appointment not found with id: ${appointmentId}`);
    }

    // Get patient phone number
    const phoneNumber = appointment.patient.getWhatsAppNumber();

    // Determine template type based on appointment status
    let templateType;
    
    if (appointment.status === 'rescheduled') {
      templateType = 'appointment_rescheduled';
    } else if (appointment.status === 'cancelled') {
      templateType = 'appointment_cancelled';
    } else {
      templateType = 'appointment_confirmation';
    }

    // Find appropriate template
    const messageTemplate = await MessageTemplate.findOne({
      type: templateType,
      isActive: true
    });

    if (!messageTemplate) {
      throw new Error(`No active ${templateType} template found`);
    }

    // Prepare variables for template
    const appointmentDate = moment(appointment.date).format('dddd, MMMM D, YYYY');
    const appointmentTime = `${appointment.startTime} - ${appointment.endTime}`;
    const doctorName = appointment.doctor.name;
    const departmentName = appointment.department.name;
    const locationStr = `${appointment.location.building || ''}, Floor ${appointment.location.floor || ''}, Room ${appointment.location.roomNumber || ''}`;
    
    const variables = {
      patient_name: appointment.patient.name,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      doctor_name: doctorName,
      department: departmentName,
      location: locationStr,
      preparation: appointment.preparationInstructions || 'No special preparation required.',
      reason: appointment.cancelReason || appointment.rescheduleDetails?.reason || 'No reason provided'
    };

    // For rescheduled appointments, add previous date information
    if (appointment.status === 'rescheduled' && appointment.rescheduleDetails) {
      const previousDate = moment(appointment.rescheduleDetails.previousDate).format('dddd, MMMM D, YYYY');
      const previousTime = `${appointment.rescheduleDetails.previousStartTime} - ${appointment.rescheduleDetails.previousEndTime}`;
      
      variables.previous_date = previousDate;
      variables.previous_time = previousTime;
    }

    // Send the message
    const messageResponse = await sendTemplatedMessage(
      phoneNumber,
      messageTemplate.externalTemplateId,
      variables
    );

    // Record the message in our database
    const message = await Message.create({
      patient: appointment.patient._id,
      appointment: appointment._id,
      direction: 'outbound',
      channel: 'whatsapp',
      messageTemplate: messageTemplate._id,
      content: messageTemplate.content,
      variables: variables,
      externalMessageId: messageResponse.id,
      status: 'sent',
      sentAt: new Date()
    });

    return message;
  } catch (error) {
    logger.error(`Error sending appointment update notification: ${error.message}`);
    throw error;
  }
};

/**
 * Send status update notification
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} - Message record
 */
const sendStatusUpdateNotification = async (appointmentId) => {
  try {
    // This is a wrapper around sendAppointmentUpdateNotification for status changes
    return await sendAppointmentUpdateNotification(appointmentId);
  } catch (error) {
    logger.error(`Error sending status update notification: ${error.message}`);
    throw error;
  }
};

/**
 * Process incoming WhatsApp message from webhook
 * @param {Object} webhookData - Webhook payload from 1CONFIRMED
 * @returns {Promise<Object>} - Response record
 */
const processIncomingMessage = async (webhookData) => {
  try {
    logger.info(`Processing incoming WhatsApp message: ${JSON.stringify(webhookData)}`);
    
    // Extract key information from webhook payload
    const { from, id, timestamp, type } = webhookData;
    let content, action = 'none';

    // Extract content based on message type
    if (type === 'text') {
      content = webhookData.text.body;
    } else if (type === 'interactive' && webhookData.interactive.type === 'button_reply') {
      content = webhookData.interactive.button_reply.title;
      action = webhookData.interactive.button_reply.id.toLowerCase();
    } else {
      content = `Message of type: ${type}`;
    }

    // Find patient by phone number
    const patientPhoneNumber = from.replace(/\+/, '');
    const patient = await Patient.findOne({
      phoneNumber: { $regex: patientPhoneNumber, $options: 'i' }
    });

    if (!patient) {
      logger.warn(`Received message from unknown phone number: ${from}`);
      return { success: false, error: 'Patient not found' };
    }

    // Find recent messages to this patient
    const recentMessages = await Message.find({
      patient: patient._id,
      direction: 'outbound',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    })
      .populate('appointment')
      .sort('-createdAt')
      .limit(5);
    
    // If we have recent messages, associate this with the most recent appointment
    let appointment = null;
    
    for (const message of recentMessages) {
      if (message.appointment) {
        appointment = message.appointment;
        break;
      }
    }

    // Create record of incoming message
    const incomingMessage = await Message.create({
      patient: patient._id,
      appointment: appointment ? appointment._id : null,
      direction: 'inbound',
      channel: 'whatsapp',
      content: content,
      externalMessageId: id,
      status: 'read',
      readAt: new Date(timestamp * 1000),
      responseAction: action
    });

    // If this is a response to a specific outbound message, link them
    if (webhookData.context && webhookData.context.id) {
      const outboundMessage = await Message.findOne({
        externalMessageId: webhookData.context.id
      });
      
      if (outboundMessage) {
        outboundMessage.responseMessage = incomingMessage._id;
        outboundMessage.responseAction = action;
        await outboundMessage.save();
      }
    }

    // Process patient response if it relates to an appointment
    if (appointment && action !== 'none') {
      switch (action) {
        case 'confirm':
          appointment.status = 'confirmed';
          await appointment.save();
          
          // Send confirmation acknowledgment
          await sendTextMessage(
            from,
            `Thank you for confirming your appointment on ${moment(appointment.date).format('dddd, MMMM D, YYYY')} at ${appointment.startTime}.`
          );
          break;
          
        case 'reschedule':
          // Mark as pending reschedule - staff will handle the actual rescheduling
          appointment.status = 'rescheduled';
          await appointment.save();
          
          // Send reschedule acknowledgment
          await sendTextMessage(
            from,
            `We've received your request to reschedule your appointment. Our staff will contact you shortly to arrange a new time.`
          );
          break;
          
        case 'cancel':
          appointment.status = 'cancelled';
          appointment.cancelReason = 'Cancelled by patient via WhatsApp';
          await appointment.save();
          
          // Send cancellation acknowledgment
          await sendTextMessage(
            from,
            `Your appointment on ${moment(appointment.date).format('dddd, MMMM D, YYYY')} at ${appointment.startTime} has been cancelled. If you need to schedule a new appointment, please contact us.`
          );
          break;
      }
    }

    return incomingMessage;
  } catch (error) {
    logger.error(`Error processing incoming message: ${error.message}`);
    throw error;
  }
};

/**
 * Schedule reminders for upcoming appointments
 * @returns {Promise<Object>} - Results of the scheduling operation
 */
const scheduleReminders = async () => {
  try {
    const now = new Date();
    const results = {
      scheduled: 0,
      errors: 0,
      details: []
    };

    // Find all unsent reminders scheduled before now
    const appointments = await Appointment.find({
      'reminders.scheduledTime': { $lte: now },
      'reminders.sent': false,
      status: { $nin: ['cancelled', 'completed', 'no-show'] }
    }).populate('patient').populate('doctor').populate('department');

    for (const appointment of appointments) {
      for (const reminder of appointment.reminders) {
        if (!reminder.sent && reminder.scheduledTime <= now) {
          try {
            // Send the reminder
            await sendAppointmentReminder(appointment._id);
            results.scheduled++;
            results.details.push({
              appointmentId: appointment._id,
              status: 'success'
            });
          } catch (error) {
            results.errors++;
            results.details.push({
              appointmentId: appointment._id,
              status: 'error',
              message: error.message
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    logger.error(`Error scheduling reminders: ${error.message}`);
    throw error;
  }
};

module.exports = {
  sendTemplatedMessage,
  sendTextMessage,
  sendInteractiveMessage,
  sendAppointmentReminder,
  sendAppointmentNotification,
  sendAppointmentUpdateNotification,
  sendStatusUpdateNotification,
  processIncomingMessage,
  scheduleReminders
};


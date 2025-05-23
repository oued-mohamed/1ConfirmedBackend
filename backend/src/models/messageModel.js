// File: backend/models/messageModel.js
// Message model for tracking all WhatsApp communications

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms', 'email'],
      default: 'whatsapp'
    },
    messageTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MessageTemplate'
    },
    content: {
      type: String,
      required: true
    },
    variables: {
      type: Map,
      of: String
    },
    externalMessageId: {
      type: String
      // ID of the message in 1CONFIRMED system
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'queued'
    },
    statusDetails: {
      type: String
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedAt: Date,
    responseMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    responseAction: {
      type: String,
      enum: ['confirm', 'reschedule', 'cancel', 'other', 'none'],
      default: 'none'
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Message', MessageSchema);


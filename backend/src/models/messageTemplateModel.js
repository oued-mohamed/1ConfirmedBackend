// File: backend/models/messageTemplateModel.js
// Message Template model for WhatsApp message templates

const mongoose = require('mongoose');

const MessageTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a template name'],
      trim: true,
      unique: true,
      maxlength: [50, 'Template name cannot be more than 50 characters']
    },
    type: {
      type: String,
      enum: ['appointment_reminder', 'appointment_confirmation', 'appointment_rescheduled', 'appointment_cancelled', 'general_notification', 'follow_up'],
      required: [true, 'Please specify template type']
    },
    content: {
      type: String,
      required: [true, 'Please add template content'],
      maxlength: [1000, 'Template content cannot be more than 1000 characters']
    },
    variables: [
      {
        name: {
          type: String,
          required: true
        },
        description: String,
        required: {
          type: Boolean,
          default: true
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    externalTemplateId: {
      type: String,
      // ID of the template in 1CONFIRMED system
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MessageTemplate', MessageTemplateSchema);


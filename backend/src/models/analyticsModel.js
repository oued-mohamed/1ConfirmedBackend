// File: backend/models/analyticsModel.js
// Analytics model for tracking message effectiveness

const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    messageStats: {
      sent: {
        type: Number,
        default: 0
      },
      delivered: {
        type: Number,
        default: 0
      },
      read: {
        type: Number,
        default: 0
      },
      failed: {
        type: Number,
        default: 0
      },
      responseRate: {
        type: Number,
        default: 0
      }
    },
    appointmentStats: {
      scheduled: {
        type: Number,
        default: 0
      },
      confirmed: {
        type: Number,
        default: 0
      },
      rescheduled: {
        type: Number,
        default: 0
      },
      cancelled: {
        type: Number,
        default: 0
      },
      completed: {
        type: Number,
        default: 0
      },
      noShow: {
        type: Number,
        default: 0
      },
      confirmationRate: {
        type: Number,
        default: 0
      },
      noShowRate: {
        type: Number,
        default: 0
      }
    },
    departmentBreakdown: [
      {
        department: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department'
        },
        appointmentCount: {
          type: Number,
          default: 0
        },
        confirmationRate: {
          type: Number,
          default: 0
        },
        noShowRate: {
          type: Number,
          default: 0
        }
      }
    ],
    doctorBreakdown: [
      {
        doctor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Doctor'
        },
        appointmentCount: {
          type: Number,
          default: 0
        },
        confirmationRate: {
          type: Number,
          default: 0
        },
        noShowRate: {
          type: Number,
          default: 0
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Analytics', AnalyticsSchema);
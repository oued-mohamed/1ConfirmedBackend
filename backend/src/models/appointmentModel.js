// File: backend/models/appointmentModel.js (continued)
// Appointment model - continuation from previous code

const mongoose = require('mongoose');
const moment = require('moment');

const AppointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Please add a patient']
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Please add a doctor']
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Please add a department']
    },
    date: {
      type: Date,
      required: [true, 'Please add appointment date']
    },
    startTime: {
      type: String,
      required: [true, 'Please add start time']
    },
    endTime: {
      type: String,
      required: [true, 'Please add end time']
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no-show'],
      default: 'scheduled'
    },
    type: {
      type: String,
      enum: ['consultation', 'follow-up', 'procedure', 'test', 'vaccination', 'other'],
      default: 'consultation'
    },
    reason: {
      type: String,
      required: [true, 'Please add reason for appointment'],
      maxlength: [200, 'Reason cannot be more than 200 characters']
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot be more than 500 characters']
    },
    location: {
      building: String,
      floor: String,
      roomNumber: String
    },
    preparationInstructions: {
      type: String
    },
    documentsRequired: [String],
    reminders: [
      {
        type: {
          type: String,
          enum: ['whatsapp', 'email', 'sms'],
          default: 'whatsapp'
        },
        scheduledTime: Date,
        sent: {
          type: Boolean,
          default: false
        },
        messageId: String,
        status: {
          type: String,
          enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
          default: 'pending'
        },
        response: {
          received: {
            type: Boolean,
            default: false
          },
          action: {
            type: String,
            enum: ['confirm', 'reschedule', 'cancel', 'none'],
            default: 'none'
          },
          receivedAt: Date,
          content: String
        }
      }
    ],
    cancelReason: String,
    rescheduleDetails: {
      previousDate: Date,
      previousStartTime: String,
      previousEndTime: String,
      reason: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Create reminder objects based on appointment date
AppointmentSchema.pre('save', function (next) {
  // If it's a new appointment or its date was modified
  if (this.isNew || this.isModified('date')) {
    const appointmentDate = moment(this.date);
    
    // Clear existing reminders
    this.reminders = [];
    
    // Create reminder 24 hours before
    this.reminders.push({
      type: 'whatsapp',
      scheduledTime: moment(appointmentDate).subtract(24, 'hours').toDate(),
      sent: false,
      status: 'pending'
    });
    
    // Create reminder 2 hours before
    this.reminders.push({
      type: 'whatsapp',
      scheduledTime: moment(appointmentDate).subtract(2, 'hours').toDate(),
      sent: false,
      status: 'pending'
    });
  }
  
  next();
});

// Method to check if appointment times conflict with existing appointments
AppointmentSchema.statics.checkAvailability = async function (doctorId, date, startTime, endTime, excludeAppointmentId = null) {
  const appointmentDate = moment(date).startOf('day').toDate();
  const nextDay = moment(date).add(1, 'days').startOf('day').toDate();
  
  // Build the query to check for conflicts
  const query = {
    doctor: doctorId,
    date: {
      $gte: appointmentDate,
      $lt: nextDay
    },
    $or: [
      // New appointment starts during an existing appointment
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      // New appointment ends during an existing appointment
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      // New appointment completely contains an existing appointment
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ],
    status: { $nin: ['cancelled', 'no-show'] }
  };
  
  // Exclude the current appointment if it's an update
  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }
  
  const conflicts = await this.find(query).select('startTime endTime');
  return conflicts.length === 0;
};

module.exports = mongoose.model('Appointment', AppointmentSchema);


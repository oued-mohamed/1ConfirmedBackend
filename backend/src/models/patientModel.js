// File: backend/models/patientModel.js
// Patient model

const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
      trim: true,
      unique: true
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Please add date of birth']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'United States'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer not to say'],
      required: [true, 'Please specify gender']
    },
    medicalRecordNumber: {
      type: String,
      unique: true,
      required: [true, 'Please add medical record number']
    },
    insuranceDetails: {
      provider: String,
      policyNumber: String,
      expiryDate: Date
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phoneNumber: String
    },
    communicationPreferences: {
      whatsapp: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    optOut: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for patient's upcoming appointments
PatientSchema.virtual('upcomingAppointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'patient',
  match: { date: { $gte: new Date() } },
  options: { sort: { date: 1 } }
});

// Virtual for patient's past appointments
PatientSchema.virtual('pastAppointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'patient',
  match: { date: { $lt: new Date() } },
  options: { sort: { date: -1 } }
});

// Method to format phone number for WhatsApp (ensure correct international format)
PatientSchema.methods.getWhatsAppNumber = function () {
  let number = this.phoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
  
  // Ensure it has the international format (starts with +)
  if (!number.startsWith('+')) {
    // Default to US if no country code
    if (!number.startsWith('1')) {
      number = '+1' + number;
    } else {
      number = '+' + number;
    }
  }
  
  return number;
};

module.exports = mongoose.model('Patient', PatientSchema);


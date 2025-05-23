// File: backend/models/doctorModel.js
// Doctor model

const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    specialization: {
      type: String,
      required: [true, 'Please add specialization']
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Please add department']
    },
    licenseNumber: {
      type: String,
      required: [true, 'Please add license number'],
      unique: true
    },
    contactNumber: {
      type: String,
      required: [true, 'Please add contact number']
    },
    email: {
      type: String,
      required: [true, 'Please add email'],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters']
    },
    photo: {
      type: String,
      default: 'default-doctor.jpg'
    },
    availableHours: [
      {
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        startTime: String,
        endTime: String,
        isAvailable: {
          type: Boolean,
          default: true
        }
      }
    ],
    averageAppointmentDuration: {
      type: Number, // in minutes
      default: 30
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for doctor's upcoming appointments
DoctorSchema.virtual('upcomingAppointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'doctor',
  match: { date: { $gte: new Date() } },
  options: { sort: { date: 1 } }
});

module.exports = mongoose.model('Doctor', DoctorSchema);


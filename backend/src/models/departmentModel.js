// File: backend/models/departmentModel.js
// Department model

const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a department name'],
      trim: true,
      unique: true,
      maxlength: [50, 'Department name cannot be more than 50 characters']
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    location: {
      building: String,
      floor: String,
      roomNumberPrefix: String
    },
    contactNumber: {
      type: String
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
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

// Virtual for department's doctors
DepartmentSchema.virtual('doctors', {
  ref: 'Doctor',
  localField: '_id',
  foreignField: 'department'
});

module.exports = mongoose.model('Department', DepartmentSchema);


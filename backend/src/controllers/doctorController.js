// File: backend/controllers/doctorController.js
// Doctor controller

const Doctor = require('../models/doctorModel');
const User = require('../models/userModel');
const { ErrorResponse } = require('../middlewares/errorMiddleware');
const logger = require('../utils/logger');

// @desc    Get all doctors
// @route   GET /api/doctors
// @access  Private
exports.getDoctors = async (req, res, next) => {
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
    query = Doctor.find(JSON.parse(queryStr))
      .populate('department', 'name location');

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
      query = query.sort('name');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Doctor.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const doctors = await query;

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
      count: doctors.length,
      pagination,
      total,
      data: doctors
    });
  } catch (error) {
    logger.error(`Get doctors error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single doctor
// @route   GET /api/doctors/:id
// @access  Private
exports.getDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('department', 'name location');

    if (!doctor) {
      return next(
        new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    logger.error(`Get doctor error: ${error.message}`);
    next(error);
  }
};

// @desc    Create new doctor
// @route   POST /api/doctors
// @access  Private
exports.createDoctor = async (req, res, next) => {
  try {
    // If a user account is provided, link it
    if (req.body.user) {
      const user = await User.findById(req.body.user);
      
      if (!user) {
        return next(
          new ErrorResponse(`User not found with id of ${req.body.user}`, 404)
        );
      }
      
      // Update user's role to doctor if not already
      if (user.role !== 'doctor') {
        await User.findByIdAndUpdate(user._id, { role: 'doctor' });
      }
    }
    
    const doctor = await Doctor.create(req.body);

    res.status(201).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    logger.error(`Create doctor error: ${error.message}`);
    next(error);
  }
};

// @desc    Update doctor
// @route   PUT /api/doctors/:id
// @access  Private
exports.updateDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!doctor) {
      return next(
        new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    logger.error(`Update doctor error: ${error.message}`);
    next(error);
  }
};

// @desc    Delete doctor
// @route   DELETE /api/doctors/:id
// @access  Private
exports.deleteDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return next(
        new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
      );
    }

    await doctor.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Delete doctor error: ${error.message}`);
    next(error);
  }
};

// @desc    Get doctor's availability
// @route   GET /api/doctors/:id/availability
// @access  Private
exports.getDoctorAvailability = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return next(
        new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
      );
    }

    // Get date from query or use today
    const date = req.query.date 
      ? new Date(req.query.date) 
      : new Date();
    
    // Get day of week (0-6, where 0 is Sunday)
    const dayOfWeek = date.getDay();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // Get doctor's available hours for that day
    const availableHours = doctor.availableHours.find(
      hours => hours.day === days[dayOfWeek] && hours.isAvailable
    );
    
    if (!availableHours) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Doctor is not available on this day',
        data: []
      });
    }
    
    // Get all appointments for that doctor on that date
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const appointments = await Appointment.find({
      doctor: doctor._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled'] }
    }).select('startTime endTime');
    
    // Parse start and end times to compare
    const start = availableHours.startTime.split(':').map(Number);
    const end = availableHours.endTime.split(':').map(Number);
    
    // Create slots based on doctor's average appointment duration
    const slotDuration = doctor.averageAppointmentDuration || 30; // minutes
    const slots = [];
    
    let current = new Date(date);
    current.setHours(start[0], start[1], 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(end[0], end[1], 0, 0);
    
    while (current < endTime) {
      const slotStart = new Date(current);
      current.setMinutes(current.getMinutes() + slotDuration);
      
      if (current <= endTime) {
        const slotEnd = new Date(current);
        
        // Format times to string for comparison
        const startTimeStr = `${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`;
        const endTimeStr = `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`;
        
        // Check if the slot conflicts with any appointment
        const isBooked = appointments.some(appointment => {
          return (
            (startTimeStr >= appointment.startTime && startTimeStr < appointment.endTime) ||
            (endTimeStr > appointment.startTime && endTimeStr <= appointment.endTime) ||
            (startTimeStr <= appointment.startTime && endTimeStr >= appointment.endTime)
          );
        });
        
        slots.push({
          startTime: startTimeStr,
          endTime: endTimeStr,
          available: !isBooked
        });
      }
    }
    
    res.status(200).json({
      success: true,
      available: true,
      availableHours,
      data: slots
    });
  } catch (error) {
    logger.error(`Get doctor availability error: ${error.message}`);
    next(error);
  }
};


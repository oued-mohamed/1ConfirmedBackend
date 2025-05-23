// File: backend/controllers/appointmentController.js
// Appointment controller

const Appointment = require('../models/appointmentModel');
const Patient = require('../models/patientModel');
const Doctor = require('../models/doctorModel');
const Department = require('../models/departmentModel');
const { ErrorResponse } = require('../middlewares/errorMiddleware');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');
const moment = require('moment');

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private
exports.getAppointments = async (req, res, next) => {
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
    query = Appointment.find(JSON.parse(queryStr))
      .populate('patient', 'name phoneNumber')
      .populate('doctor', 'name specialization')
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
      query = query.sort('-date');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Appointment.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const appointments = await query;

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
      count: appointments.length,
      pagination,
      total,
      data: appointments
    });
  } catch (error) {
    logger.error(`Get appointments error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'name phoneNumber email dateOfBirth gender')
      .populate('doctor', 'name specialization')
      .populate('department', 'name location');

    if (!appointment) {
      return next(
        new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    logger.error(`Get appointment error: ${error.message}`);
    next(error);
  }
};

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Private
exports.createAppointment = async (req, res, next) => {
  try {
    // Validate patient, doctor, and department exist
    const patient = await Patient.findById(req.body.patient);
    const doctor = await Doctor.findById(req.body.doctor);
    const department = await Department.findById(req.body.department);

    if (!patient) {
      return next(new ErrorResponse(`Patient not found with id of ${req.body.patient}`, 404));
    }

    if (!doctor) {
      return next(new ErrorResponse(`Doctor not found with id of ${req.body.doctor}`, 404));
    }

    if (!department) {
      return next(new ErrorResponse(`Department not found with id of ${req.body.department}`, 404));
    }

    // Check for appointment conflicts
    const isAvailable = await Appointment.checkAvailability(
      req.body.doctor,
      req.body.date,
      req.body.startTime,
      req.body.endTime
    );

    if (!isAvailable) {
      return next(
        new ErrorResponse(
          `Doctor is not available at the requested time.`,
          400
        )
      );
    }

    // Determine room number if not provided
    if (!req.body.location || !req.body.location.roomNumber) {
      if (!req.body.location) {
        req.body.location = {};
      }
      
      // Assign from department with random number
      if (department.location && department.location.roomNumberPrefix) {
        req.body.location.building = department.location.building;
        req.body.location.floor = department.location.floor;
        req.body.location.roomNumber = `${department.location.roomNumberPrefix}-${Math.floor(Math.random() * 100) + 1}`;
      }
    }

    // Add user who created the appointment
    req.body.createdBy = req.user.id;

    // Create appointment
    const appointment = await Appointment.create(req.body);

    // Send initial notification if requested
    if (req.body.sendNotification) {
      try {
        await whatsappService.sendAppointmentNotification(appointment._id);
      } catch (error) {
        logger.error(`Failed to send initial notification: ${error.message}`);
        // Don't fail the request if notification fails
      }
    }

    res.status(201).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    logger.error(`Create appointment error: ${error.message}`);
    next(error);
  }
};

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
exports.updateAppointment = async (req, res, next) => {
  try {
    let appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return next(
        new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
      );
    }

    // Check if date or time is being updated
    if (
      (req.body.date && req.body.date !== appointment.date.toISOString().split('T')[0]) ||
      (req.body.startTime && req.body.startTime !== appointment.startTime) ||
      (req.body.endTime && req.body.endTime !== appointment.endTime)
    ) {
      // Save old date/time for reschedule record if status is changing to 'rescheduled'
      if (req.body.status === 'rescheduled') {
        req.body.rescheduleDetails = {
          previousDate: appointment.date,
          previousStartTime: appointment.startTime,
          previousEndTime: appointment.endTime,
          reason: req.body.rescheduleReason || 'No reason provided'
        };
      }

      // Check for conflicts with other appointments
      const isAvailable = await Appointment.checkAvailability(
        req.body.doctor || appointment.doctor,
        req.body.date || appointment.date,
        req.body.startTime || appointment.startTime,
        req.body.endTime || appointment.endTime,
        appointment._id
      );

      if (!isAvailable) {
        return next(
          new ErrorResponse(
            `Doctor is not available at the requested time.`,
            400
          )
        );
      }
    }

    // If status is changing to 'cancelled', record the reason
    if (req.body.status === 'cancelled' && appointment.status !== 'cancelled') {
      req.body.cancelReason = req.body.cancelReason || 'No reason provided';
    }

    // Update appointment
    appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('patient', 'name phoneNumber')
      .populate('doctor', 'name specialization')
      .populate('department', 'name location');

    // Send notification if status changed or appointment was rescheduled
    if (
      (req.body.status && req.body.status !== appointment.status) ||
      req.body.rescheduleDetails
    ) {
      try {
        await whatsappService.sendAppointmentUpdateNotification(appointment._id);
      } catch (error) {
        logger.error(`Failed to send update notification: ${error.message}`);
        // Don't fail the request if notification fails
      }
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    logger.error(`Update appointment error: ${error.message}`);
    next(error);
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private
exports.deleteAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return next(
        new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
      );
    }

    await appointment.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Delete appointment error: ${error.message}`);
    next(error);
  }
};

// @desc    Get upcoming appointments
// @route   GET /api/appointments/upcoming
// @access  Private
exports.getUpcomingAppointments = async (req, res, next) => {
  try {
    const now = new Date();
    
    const appointments = await Appointment.find({
      date: { $gte: now },
      status: { $nin: ['cancelled', 'completed'] }
    })
      .populate('patient', 'name phoneNumber')
      .populate('doctor', 'name specialization')
      .populate('department', 'name location')
      .sort('date startTime');

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    logger.error(`Get upcoming appointments error: ${error.message}`);
    next(error);
  }
};

// @desc    Get appointments for today
// @route   GET /api/appointments/today
// @access  Private
exports.getTodayAppointments = async (req, res, next) => {
  try {
    const startOfDay = moment().startOf('day').toDate();
    const endOfDay = moment().endOf('day').toDate();
    
    const appointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled'] }
    })
      .populate('patient', 'name phoneNumber')
      .populate('doctor', 'name specialization')
      .populate('department', 'name location')
      .sort('startTime');

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    logger.error(`Get today's appointments error: ${error.message}`);
    next(error);
  }
};

// @desc    Get appointments by patient
// @route   GET /api/appointments/patient/:patientId
// @access  Private
exports.getPatientAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ patient: req.params.patientId })
      .populate('doctor', 'name specialization')
      .populate('department', 'name location')
      .sort('-date');

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    logger.error(`Get patient appointments error: ${error.message}`);
    next(error);
  }
};

// @desc    Get appointments by doctor
// @route   GET /api/appointments/doctor/:doctorId
// @access  Private
exports.getDoctorAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ doctor: req.params.doctorId })
      .populate('patient', 'name phoneNumber')
      .populate('department', 'name location')
      .sort('-date');

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    logger.error(`Get doctor appointments error: ${error.message}`);
    next(error);
  }
};

// @desc    Send reminder for an appointment
// @route   POST /api/appointments/:id/remind
// @access  Private
exports.sendAppointmentReminder = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient')
      .populate('doctor')
      .populate('department');

    if (!appointment) {
      return next(
        new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
      );
    }

    // Send the reminder
    const result = await whatsappService.sendAppointmentReminder(appointment._id, req.body.templateId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Send appointment reminder error: ${error.message}`);
    next(error);
  }
};

// @desc    Change appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private
exports.changeAppointmentStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    
    if (!status) {
      return next(new ErrorResponse('Please provide a status', 400));
    }
    
    // Validate status
    const validStatuses = ['scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no-show'];
    
    if (!validStatuses.includes(status)) {
      return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
    }
    
    let updateData = { status };
    
    // Add reason if provided
    if (status === 'cancelled' && reason) {
      updateData.cancelReason = reason;
    } else if (status === 'rescheduled' && reason) {
      // For reschedule, the actual date change should be done in the main update endpoint
      // This is just for quick status changes
      updateData.rescheduleDetails = {
        reason
      };
    }
    
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('patient', 'name phoneNumber')
      .populate('doctor', 'name specialization')
      .populate('department', 'name location');
    
    if (!appointment) {
      return next(
        new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
      );
    }
    
    // Send notification for status change if not initiated by patient
    if (!req.body.patientInitiated) {
      try {
        await whatsappService.sendStatusUpdateNotification(appointment._id);
      } catch (error) {
        logger.error(`Failed to send status update notification: ${error.message}`);
        // Don't fail the request if notification fails
      }
    }
    
    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    logger.error(`Change appointment status error: ${error.message}`);
    next(error);
  }
};


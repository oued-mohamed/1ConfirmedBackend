// File: backend/controllers/departmentController.js
// Department controller

const Department = require('../models/departmentModel');
const { ErrorResponse } = require('../middlewares/errorMiddleware');
const logger = require('../utils/logger');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res, next) => {
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
    query = Department.find(JSON.parse(queryStr));

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
    const total = await Department.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const departments = await query;

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
      count: departments.length,
      pagination,
      total,
      data: departments
    });
  } catch (error) {
    logger.error(`Get departments error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single department
// @route   GET /api/departments/:id
// @access  Private
exports.getDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'name specialization');

    if (!department) {
      return next(
        new ErrorResponse(`Department not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Get department error: ${error.message}`);
    next(error);
  }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private
exports.createDepartment = async (req, res, next) => {
  try {
    const department = await Department.create(req.body);

    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Create department error: ${error.message}`);
    next(error);
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private
exports.updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!department) {
      return next(
        new ErrorResponse(`Department not found with id of ${req.params.id}`, 404)
      );
    }

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Update department error: ${error.message}`);
    next(error);
  }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private
exports.deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return next(
        new ErrorResponse(`Department not found with id of ${req.params.id}`, 404)
      );
    }

    await department.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Delete department error: ${error.message}`);
    next(error);
  }
};

// @desc    Get department doctors
// @route   GET /api/departments/:id/doctors
// @access  Private
exports.getDepartmentDoctors = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return next(
        new ErrorResponse(`Department not found with id of ${req.params.id}`, 404)
      );
    }

    const doctors = await Doctor.find({ department: req.params.id, active: true });

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors
    });
  } catch (error) {
    logger.error(`Get department doctors error: ${error.message}`);
    next(error);
  }
};
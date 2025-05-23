// File: backend/controllers/analyticsController.js
// Analytics controller

const Appointment = require('../models/appointmentModel');
const Message = require('../models/messageModel');
const Department = require('../models/departmentModel');
const Doctor = require('../models/doctorModel');
const { ErrorResponse } = require('../middlewares/errorMiddleware');
const logger = require('../utils/logger');
const moment = require('moment');

// @desc    Get appointment statistics
// @route   GET /api/analytics/appointments
// @access  Private
exports.getAppointmentStats = async (req, res, next) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : moment(endDate).subtract(30, 'days').toDate();

    // Get appointment stats
    const totalAppointments = await Appointment.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const appointmentsByStatus = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate percentages
    const statusStats = {};
    
    appointmentsByStatus.forEach(item => {
      statusStats[item._id] = {
        count: item.count,
        percentage: (item.count / totalAppointments * 100).toFixed(2)
      };
    });

    // Get no-show rate
    const completedAppointments = await Appointment.countDocuments({
      status: { $in: ['completed', 'no-show'] },
      date: { $gte: startDate, $lte: endDate }
    });

    const noShowAppointments = await Appointment.countDocuments({
      status: 'no-show',
      date: { $gte: startDate, $lte: endDate }
    });

    const noShowRate = completedAppointments > 0 
      ? (noShowAppointments / completedAppointments * 100).toFixed(2) 
      : 0;

    // Get average appointments per day
    const daysDiff = moment(endDate).diff(moment(startDate), 'days') + 1;
    const avgAppointmentsPerDay = (totalAppointments / daysDiff).toFixed(2);

    res.status(200).json({
      success: true,
      data: {
        totalAppointments,
        statusStats,
        noShowRate,
        avgAppointmentsPerDay,
        dateRange: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    logger.error(`Get appointment stats error: ${error.message}`);
    next(error);
  }
};

// @desc    Get message statistics
// @route   GET /api/analytics/messages
// @access  Private
exports.getMessageStats = async (req, res, next) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : moment(endDate).subtract(30, 'days').toDate();

    // Get total messages
    const totalMessages = await Message.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get outbound messages
    const outboundMessages = await Message.countDocuments({
      direction: 'outbound',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get inbound messages
    const inboundMessages = await Message.countDocuments({
      direction: 'inbound',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get message status distribution
    const messagesByStatus = await Message.aggregate([
      {
        $match: {
          direction: 'outbound',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate delivery rate
    const deliveredMessages = messagesByStatus.find(item => item._id === 'delivered' || item._id === 'read');
    const deliveryRate = outboundMessages > 0 && deliveredMessages
      ? ((deliveredMessages.count / outboundMessages) * 100).toFixed(2)
      : 0;

    // Calculate response rate (messages with a linked response)
    const messagesWithResponse = await Message.countDocuments({
      direction: 'outbound',
      responseMessage: { $exists: true, $ne: null },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const responseRate = outboundMessages > 0
      ? ((messagesWithResponse / outboundMessages) * 100).toFixed(2)
      : 0;

    // Get action distribution
    const actionDistribution = await Message.aggregate([
      {
        $match: {
          direction: 'inbound',
          responseAction: { $ne: 'none' },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$responseAction',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMessages,
        outboundMessages,
        inboundMessages,
        messagesByStatus,
        deliveryRate,
        responseRate,
        actionDistribution,
        dateRange: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    logger.error(`Get message stats error: ${error.message}`);
    next(error);
  }
};

// @desc    Get department performance
// @route   GET /api/analytics/departments
// @access  Private
exports.getDepartmentPerformance = async (req, res, next) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : moment(endDate).subtract(30, 'days').toDate();

    // Get appointment counts by department
    const appointmentsByDepartment = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $unwind: '$departmentInfo'
      },
      {
        $group: {
          _id: {
            departmentId: '$department',
            departmentName: '$departmentInfo.name'
          },
          totalAppointments: { $sum: 1 },
          confirmedAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0]
            }
          },
          completedAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          noShowAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0]
            }
          },
          cancelledAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          departmentId: '$_id.departmentId',
          departmentName: '$_id.departmentName',
          totalAppointments: 1,
          confirmedAppointments: 1,
          completedAppointments: 1,
          noShowAppointments: 1,
          cancelledAppointments: 1,
          confirmationRate: {
            $cond: [
              { $eq: ['$totalAppointments', 0] },
              0,
              { $multiply: [{ $divide: ['$confirmedAppointments', '$totalAppointments'] }, 100] }
            ]
          },
          noShowRate: {
            $cond: [
              { $eq: [{ $add: ['$completedAppointments', '$noShowAppointments'] }, 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      '$noShowAppointments',
                      { $add: ['$completedAppointments', '$noShowAppointments'] }
                    ]
                  },
                  100
                ]
              }
            ]
          },
          cancellationRate: {
            $cond: [
              { $eq: ['$totalAppointments', 0] },
              0,
              { $multiply: [{ $divide: ['$cancelledAppointments', '$totalAppointments'] }, 100] }
            ]
          }
        }
      },
      {
        $sort: { totalAppointments: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: appointmentsByDepartment.length,
      data: appointmentsByDepartment,
      dateRange: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    logger.error(`Get department performance error: ${error.message}`);
    next(error);
  }
};

// @desc    Get doctor performance
// @route   GET /api/analytics/doctors
// @access  Private
exports.getDoctorPerformance = async (req, res, next) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : moment(endDate).subtract(30, 'days').toDate();

    // Get appointment counts by doctor
    const appointmentsByDoctor = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctor',
          foreignField: '_id',
          as: 'doctorInfo'
        }
      },
      {
        $unwind: '$doctorInfo'
      },
      {
        $group: {
          _id: {
            doctorId: '$doctor',
            doctorName: '$doctorInfo.name'
          },
          totalAppointments: { $sum: 1 },
          confirmedAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0]
            }
          },
          completedAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          noShowAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0]
            }
          },
          cancelledAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          doctorId: '$_id.doctorId',
          doctorName: '$_id.doctorName',
          totalAppointments: 1,
          confirmedAppointments: 1,
          completedAppointments: 1,
          noShowAppointments: 1,
          cancelledAppointments: 1,
          confirmationRate: {
            $cond: [
              { $eq: ['$totalAppointments', 0] },
              0,
              { $multiply: [{ $divide: ['$confirmedAppointments', '$totalAppointments'] }, 100] }
            ]
          },
          noShowRate: {
            $cond: [
              { $eq: [{ $add: ['$completedAppointments', '$noShowAppointments'] }, 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      '$noShowAppointments',
                      { $add: ['$completedAppointments', '$noShowAppointments'] }
                    ]
                  },
                  100
                ]
              }
            ]
          },
          cancellationRate: {
            $cond: [
              { $eq: ['$totalAppointments', 0] },
              0,
              { $multiply: [{ $divide: ['$cancelledAppointments', '$totalAppointments'] }, 100] }
            ]
          }
        }
      },
      {
        $sort: { totalAppointments: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: appointmentsByDoctor.length,
      data: appointmentsByDoctor,
      dateRange: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    logger.error(`Get doctor performance error: ${error.message}`);
    next(error);
  }
};

// @desc    Get daily appointment counts
// @route   GET /api/analytics/daily
// @access  Private
exports.getDailyAppointmentCounts = async (req, res, next) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : moment(endDate).subtract(30, 'days').toDate();

    // Get daily appointment counts
    const dailyAppointments = await Appointment.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          scheduled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0]
            }
          },
          confirmed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          noShow: {
            $sum: {
              $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          },
          total: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Fill in missing dates with zero values
    const filledDailyData = [];
    let currentDate = moment(startDate);
    const endMoment = moment(endDate);
    
    while (currentDate.isSameOrBefore(endMoment)) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const existingData = dailyAppointments.find(item => item._id === dateStr);
      
      if (existingData) {
        filledDailyData.push(existingData);
      } else {
        filledDailyData.push({
          _id: dateStr,
          scheduled: 0,
          confirmed: 0,
          completed: 0,
          noShow: 0,
          cancelled: 0,
          total: 0
        });
      }
      
      currentDate.add(1, 'days');
    }

    res.status(200).json({
      success: true,
      count: filledDailyData.length,
      data: filledDailyData,
      dateRange: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    logger.error(`Get daily appointment counts error: ${error.message}`);
    next(error);
  }
};

// @desc    Get message response rates
// @route   GET /api/analytics/responses
// @access  Private
exports.getResponseRates = async (req, res, next) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : moment(endDate).subtract(30, 'days').toDate();

    // Get outbound messages with response actions
    const messageResponses = await Message.aggregate([
      {
        $match: {
          direction: 'outbound',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'messagetemplates',
          localField: 'messageTemplate',
          foreignField: '_id',
          as: 'templateInfo'
        }
      },
      {
        $unwind: {
          path: '$templateInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$templateInfo.type',
          total: { $sum: 1 },
          withResponse: {
            $sum: {
              $cond: [
                { $ne: ['$responseMessage', null] },
                1,
                0
              ]
            }
          },
          confirmAction: {
            $sum: {
              $cond: [
                { $eq: ['$responseAction', 'confirm'] },
                1,
                0
              ]
            }
          },
          rescheduleAction: {
            $sum: {
              $cond: [
                { $eq: ['$responseAction', 'reschedule'] },
                1,
                0
              ]
            }
          },
          cancelAction: {
            $sum: {
              $cond: [
                { $eq: ['$responseAction', 'cancel'] },
                1,
                0
              ]
            }
          },
          otherAction: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$responseAction', 'none'] },
                  { $ne: ['$responseAction', 'confirm'] },
                  { $ne: ['$responseAction', 'reschedule'] },
                  { $ne: ['$responseAction', 'cancel'] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          templateType: '$_id',
          total: 1,
          withResponse: 1,
          confirmAction: 1,
          rescheduleAction: 1,
          cancelAction: 1,
          otherAction: 1,
          responseRate: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$withResponse', '$total'] }, 100] }
            ]
          }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    // Add data for messages without template type
    const nullTypeIndex = messageResponses.findIndex(item => item.templateType === null);
    if (nullTypeIndex !== -1) {
      messageResponses[nullTypeIndex].templateType = 'custom';
    }

    res.status(200).json({
      success: true,
      count: messageResponses.length,
      data: messageResponses,
      dateRange: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    logger.error(`Get message response rates error: ${error.message}`);
    next(error);
  }
};
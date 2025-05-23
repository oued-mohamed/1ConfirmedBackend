// File: backend/routes/analyticsRoutes.js
// Analytics routes

const express = require('express');
const router = express.Router();
const {
  getAppointmentStats,
  getMessageStats,
  getDepartmentPerformance,
  getDoctorPerformance,
  getDailyAppointmentCounts,
  getResponseRates
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect); // All analytics routes require authentication

router.get('/appointments', getAppointmentStats);
router.get('/messages', getMessageStats);
router.get('/departments', getDepartmentPerformance);
router.get('/doctors', getDoctorPerformance);
router.get('/daily', getDailyAppointmentCounts);
router.get('/responses', getResponseRates);

module.exports = router;


// File: backend/routes/appointmentRoutes.js
// Appointment routes

const express = require('express');
const router = express.Router();
const {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getUpcomingAppointments,
  getTodayAppointments,
  getPatientAppointments,
  getDoctorAppointments,
  sendAppointmentReminder,
  changeAppointmentStatus
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect); // All appointment routes require authentication

router
  .route('/')
  .get(getAppointments)
  .post(createAppointment);


router
  .route('/:id')
  .get(getAppointment)
  .put(updateAppointment)
  .delete(authorize('admin'), deleteAppointment);

router.get('/upcoming', getUpcomingAppointments);
router.get('/today', getTodayAppointments);
router.get('/patient/:patientId', getPatientAppointments);
router.get('/doctor/:doctorId', getDoctorAppointments);
router.post('/:id/remind', sendAppointmentReminder);
router.put('/:id/status', changeAppointmentStatus);

module.exports = router;


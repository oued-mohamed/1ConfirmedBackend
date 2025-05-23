// File: backend/routes/doctorRoutes.js
// Doctor routes

const express = require('express');
const router = express.Router();
const {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorAvailability
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect); // All doctor routes require authentication

router
  .route('/')
  .get(getDoctors)
  .post(authorize('admin'), createDoctor);

router
  .route('/:id')
  .get(getDoctor)
  .put(authorize('admin'), updateDoctor)
  .delete(authorize('admin'), deleteDoctor);

router.get('/:id/availability', getDoctorAvailability);

module.exports = router;


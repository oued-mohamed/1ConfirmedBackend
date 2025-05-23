// File: backend/routes/patientRoutes.js
// Patient routes

const express = require('express');
const router = express.Router();
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient
} = require('../controllers/patientController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect); // All patient routes require authentication

router
  .route('/')
  .get(getPatients)
  .post(createPatient);

router
  .route('/:id')
  .get(getPatient)
  .put(updatePatient)
  .delete(authorize('admin'), deletePatient);

module.exports = router;


// File: backend/routes/departmentRoutes.js
// Department routes

const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentDoctors
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect); // All department routes require authentication

router
  .route('/')
  .get(getDepartments)
  .post(authorize('admin'), createDepartment);

router
  .route('/:id')
  .get(getDepartment)
  .put(authorize('admin'), updateDepartment)
  .delete(authorize('admin'), deleteDepartment);

router.get('/:id/doctors', getDepartmentDoctors);

module.exports = router;


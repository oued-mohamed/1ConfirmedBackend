// File: backend/routes/authRoutes.js
// Authentication routes

const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getMe, 
  logout,
  updateDetails,
  updatePassword
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;


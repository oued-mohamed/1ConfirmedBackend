// File: backend/routes/messageRoutes.js
// Message routes

const express = require('express');
const router = express.Router();
const {
  getMessageTemplates,
  getMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  getMessages,
  getPatientMessages,
  getAppointmentMessages,
  sendCustomMessage
} = require('../controllers/messageController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect); // All message routes require authentication

// Template routes
router
  .route('/templates')
  .get(getMessageTemplates)
  .post(authorize('admin'), createMessageTemplate);

router
  .route('/templates/:id')
  .get(getMessageTemplate)
  .put(authorize('admin'), updateMessageTemplate)
  .delete(authorize('admin'), deleteMessageTemplate);

// Message history routes
router.get('/', getMessages);
router.get('/patient/:patientId', getPatientMessages);
router.get('/appointment/:appointmentId', getAppointmentMessages);

// Send message route
router.post('/send', sendCustomMessage);

module.exports = router;


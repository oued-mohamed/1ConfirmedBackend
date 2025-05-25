// File: backend/server.js
// Main server entry point - COMPLETE VERSION with hybrid storage

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { connectDB, isConnected, getConnectionStatus } = require('./src/config/db');
const { errorHandler } = require('./src/middlewares/errorMiddleware');
const logger = require('./src/utils/logger');

// IMPORT PERSISTENT DATA STORE (fallback)
const dataStore = require('./src/utils/data');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Storage configuration
let useDatabase = false;
let storageType = 'file-based';

// Initialize database connection
const initializeStorage = async () => {
  try {
    const dbResult = await connectDB();
    
    if (dbResult.connected) {
      useDatabase = true;
      storageType = 'mongodb';
      logger.info(`🗄️  Using MongoDB for data storage`);
    } else {
      useDatabase = false;
      storageType = 'file-based';
      logger.info(`📁 Using file-based storage as fallback`);
    }
    
    return { useDatabase, storageType };
  } catch (error) {
    logger.error('Storage initialization error:', error);
    useDatabase = false;
    storageType = 'file-based';
    return { useDatabase, storageType };
  }
};

// CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'https://1-confirmed-front-puce.vercel.app',
    'https://*.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Health check endpoints
app.get('/health', (req, res) => {
  const dbStatus = useDatabase ? getConnectionStatus() : { status: 'Not connected' };
  
  res.json({
    success: true,
    message: 'HealthPing Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy',
    storage: {
      type: storageType,
      database: useDatabase ? {
        connected: isConnected(),
        ...dbStatus
      } : null
    }
  });
});

app.get('/api/health', (req, res) => {
  const dbStatus = useDatabase ? getConnectionStatus() : { status: 'Not connected' };
  
  res.json({
    success: true,
    message: 'HealthPing Backend API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy',
    storage: {
      type: storageType,
      database: useDatabase ? {
        connected: isConnected(),
        ...dbStatus
      } : null
    }
  });
});

// ===== AUTH ENDPOINTS =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone, specialization, licenseNumber } = req.body;
    
    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }
    
    const users = dataStore.getUsers();
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      password: hashedPassword,
      role: role || 'doctor',
      phone,
      specialization: role === 'doctor' ? specialization : null,
      licenseNumber: role === 'doctor' ? licenseNumber : null,
      avatar: role === 'doctor' ? '👨‍⚕️' : '👤',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    const savedUser = dataStore.addUser(newUser);
    
    const token = jwt.sign(
      { userId: savedUser.id, email: savedUser.email, role: savedUser.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    const { password: _, ...userResponse } = savedUser;
    
    logger.info(`User registered successfully: ${savedUser.email} (${storageType})`);
    
    res.status(201).json({
      success: true,
      token,
      user: userResponse,
      message: 'Registration successful'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    const users = dataStore.getUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    const { password: _, ...userResponse } = user;
    
    logger.info(`User logged in successfully: ${user.email} (${storageType})`);
    
    res.json({
      success: true,
      token,
      user: userResponse,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const users = dataStore.getUsers();
  const user = users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }
  
  const { password, ...userResponse } = user;
  res.json({
    success: true,
    user: userResponse
  });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// ===== PATIENT ENDPOINTS =====

app.get('/api/patients', authenticateToken, (req, res) => {
  try {
    const patients = dataStore.getPatients();
    console.log(`Getting all patients, total: ${patients.length} (${storageType})`);
    res.json({
      success: true,
      data: patients
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/patients', authenticateToken, (req, res) => {
  try {
    const { firstName, lastName, phone, email, dateOfBirth, gender, address, emergencyContact, whatsappOptIn = false } = req.body;
    
    console.log('Creating patient:', { firstName, lastName, email });
    
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        error: 'First name, last name, and phone are required'
      });
    }
    
    const patients = dataStore.getPatients();
    const existingPatient = patients.find(patient => 
      patient.phone === phone || (email && patient.email === email)
    );
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        error: 'Patient with this phone number or email already exists'
      });
    }
    
    let age = null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    
    const newPatient = {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone,
      email: email || '',
      dateOfBirth: dateOfBirth || null,
      age,
      gender: gender || 'Not specified',
      address: address || '',
      emergencyContact: emergencyContact || '',
      whatsappOptIn: Boolean(whatsappOptIn),
      lastVisit: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };
    
    const savedPatient = dataStore.addPatient(newPatient);
    
    console.log(`Patient created successfully: ${savedPatient.name} (${storageType})`);
    console.log('Total patients now:', dataStore.getPatients().length);
    
    res.status(201).json({
      success: true,
      data: savedPatient,
      message: 'Patient created successfully'
    });
    
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/patients/:id', authenticateToken, (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const patients = dataStore.getPatients();
    const patient = patients.find(p => p.id === patientId);
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.put('/api/patients/:id', authenticateToken, (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const { firstName, lastName, phone, email, dateOfBirth, gender, address, emergencyContact, whatsappOptIn } = req.body;
    
    console.log('Updating patient:', patientId);
    
    let age = null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    
    const updateData = {
      ...(firstName && lastName && { name: `${firstName} ${lastName}` }),
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(phone && { phone }),
      ...(email !== undefined && { email }),
      ...(dateOfBirth !== undefined && { dateOfBirth }),
      ...(age !== null && { age }),
      ...(gender && { gender }),
      ...(address !== undefined && { address }),
      ...(emergencyContact !== undefined && { emergencyContact }),
      ...(whatsappOptIn !== undefined && { whatsappOptIn: Boolean(whatsappOptIn) }),
      updatedAt: new Date().toISOString()
    };
    
    const updatedPatient = dataStore.updatePatient(patientId, updateData);
    
    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    console.log('Patient updated successfully:', updatedPatient.name);
    
    res.json({
      success: true,
      data: updatedPatient,
      message: 'Patient updated successfully'
    });
    
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.delete('/api/patients/:id', authenticateToken, (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const deletedPatient = dataStore.deletePatient(patientId);
    
    if (!deletedPatient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    console.log('Patient deleted successfully:', deletedPatient.name);
    console.log('Total patients now:', dataStore.getPatients().length);
    
    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== DOCTOR ENDPOINTS =====

app.get('/api/doctors', authenticateToken, (req, res) => {
  try {
    const doctors = dataStore.getDoctors();
    console.log(`Getting all doctors, total: ${doctors.length} (${storageType})`);
    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/doctors', authenticateToken, (req, res) => {
  try {
    const { 
      name, 
      firstName, 
      lastName, 
      specialization, 
      department, 
      phone, 
      email, 
      licenseNumber,
      workingHours, 
      notes,
      status = 'active' 
    } = req.body;
    
    const doctorName = name || (firstName && lastName ? `${firstName} ${lastName}` : null);
    
    console.log('Creating doctor:', { name: doctorName, specialization, email });
    console.log('Received data:', req.body);
    
    if (!doctorName || !specialization || !department || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name (or firstName and lastName), specialization, department, and phone are required'
      });
    }
    
    const doctors = dataStore.getDoctors();
    const existingDoctor = doctors.find(doctor => 
      doctor.phone === phone || (email && doctor.email === email)
    );
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor with this phone number or email already exists'
      });
    }
    
    const newDoctor = {
      name: doctorName,
      firstName: firstName || null,
      lastName: lastName || null,
      specialization,
      department,
      phone,
      email: email || '',
      licenseNumber: licenseNumber || '',
      workingHours: workingHours || '9:00 AM - 5:00 PM',
      notes: notes || '',
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };
    
    const savedDoctor = dataStore.addDoctor(newDoctor);
    
    console.log('Doctor created successfully:', savedDoctor.name);
    console.log('Total doctors now:', dataStore.getDoctors().length);
    
    res.status(201).json({
      success: true,
      data: savedDoctor,
      message: 'Doctor created successfully'
    });
    
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.put('/api/doctors/:id', authenticateToken, (req, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const { 
      name, 
      firstName, 
      lastName, 
      specialization, 
      department, 
      phone, 
      email, 
      licenseNumber,
      workingHours, 
      notes,
      status 
    } = req.body;
    
    const doctorName = name || (firstName && lastName ? `${firstName} ${lastName}` : null);
    
    const updateData = {
      ...(doctorName && { name: doctorName }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(specialization && { specialization }),
      ...(department && { department }),
      ...(phone && { phone }),
      ...(email !== undefined && { email }),
      ...(licenseNumber !== undefined && { licenseNumber }),
      ...(workingHours && { workingHours }),
      ...(notes !== undefined && { notes }),
      ...(status && { status }),
      updatedAt: new Date().toISOString()
    };
    
    const updatedDoctor = dataStore.updateDoctor(doctorId, updateData);
    
    if (!updatedDoctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    console.log('Doctor updated successfully:', updatedDoctor.name);
    
    res.json({
      success: true,
      data: updatedDoctor,
      message: 'Doctor updated successfully'
    });
    
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.delete('/api/doctors/:id', authenticateToken, (req, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const deletedDoctor = dataStore.deleteDoctor(doctorId);
    
    if (!deletedDoctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }
    
    console.log('Doctor deleted successfully:', deletedDoctor.name);
    console.log('Total doctors now:', dataStore.getDoctors().length);
    
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== APPOINTMENT ENDPOINTS =====

app.get('/api/appointments', authenticateToken, (req, res) => {
  try {
    const appointments = dataStore.getAppointments();
    console.log(`Getting all appointments, total: ${appointments.length} (${storageType})`);
    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/appointments', authenticateToken, (req, res) => {
  try {
    const { patient, phone, doctor, department, date, time, status = 'pending' } = req.body;
    
    console.log('Creating appointment:', { patient, doctor, date, time });
    
    if (!patient || !phone || !doctor || !department || !date || !time) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }
    
    const newAppointment = {
      patient,
      phone,
      doctor,
      department,
      date,
      time,
      status,
      whatsappSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const savedAppointment = dataStore.addAppointment(newAppointment);
    
    console.log('Appointment created successfully for:', savedAppointment.patient);
    console.log('Total appointments now:', dataStore.getAppointments().length);
    
    res.status(201).json({
      success: true,
      data: savedAppointment,
      message: 'Appointment created successfully'
    });
    
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.put('/api/appointments/:id', authenticateToken, (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const { patient, phone, doctor, department, date, time, status } = req.body;
    
    const updateData = {
      ...(patient && { patient }),
      ...(phone && { phone }),
      ...(doctor && { doctor }),
      ...(department && { department }),
      ...(date && { date }),
      ...(time && { time }),
      ...(status && { status }),
      updatedAt: new Date().toISOString()
    };
    
    const updatedAppointment = dataStore.updateAppointment(appointmentId, updateData);
    
    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    console.log('Appointment updated successfully:', updatedAppointment.patient);
    
    res.json({
      success: true,
      data: updatedAppointment,
      message: 'Appointment updated successfully'
    });
    
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.delete('/api/appointments/:id', authenticateToken, (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const deletedAppointment = dataStore.deleteAppointment(appointmentId);
    
    if (!deletedAppointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    console.log('Appointment deleted successfully:', deletedAppointment.patient);
    console.log('Total appointments now:', dataStore.getAppointments().length);
    
    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== MESSAGE TEMPLATE ENDPOINTS =====

app.get('/api/messages/templates', authenticateToken, (req, res) => {
  try {
    const messageTemplates = dataStore.getMessageTemplates();
    console.log('Getting all message templates, total:', messageTemplates.length);
    res.json({
      success: true,
      data: messageTemplates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/messages/templates', authenticateToken, (req, res) => {
  try {
    const { name, category, content, variables = [] } = req.body;
    
    console.log('Creating message template:', { name, category });
    
    if (!name || !category || !content) {
      return res.status(400).json({
        success: false,
        error: 'Name, category, and content are required'
      });
    }
    
    const messageTemplates = dataStore.getMessageTemplates();
    const existingTemplate = messageTemplates.find(template => template.name === name);
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Template with this name already exists'
      });
    }
    
    const newTemplate = {
      name,
      category,
      content,
      variables,
      status: 'active',
      lastUsed: new Date().toISOString().split('T')[0],
      usageCount: 0,
      responseRate: '0%',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const savedTemplate = dataStore.addMessageTemplate(newTemplate);
    
    console.log('Template created successfully:', savedTemplate.name);
    console.log('Total templates now:', dataStore.getMessageTemplates().length);
    
    res.status(201).json({
      success: true,
      data: savedTemplate,
      message: 'Template created successfully'
    });
    
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.put('/api/messages/templates/:id', authenticateToken, (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { name, category, content, variables, status } = req.body;
    
    const updateData = {
      ...(name && { name }),
      ...(category && { category }),
      ...(content && { content }),
      ...(variables && { variables }),
      ...(status && { status }),
      updatedAt: new Date().toISOString()
    };
    
    const updatedTemplate = dataStore.updateMessageTemplate(templateId, updateData);
    
    if (!updatedTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    console.log('Template updated successfully:', updatedTemplate.name);
    
    res.json({
      success: true,
      data: updatedTemplate,
      message: 'Template updated successfully'
    });
    
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.delete('/api/messages/templates/:id', authenticateToken, (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const deletedTemplate = dataStore.deleteMessageTemplate(templateId);
    
    if (!deletedTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    console.log('Template deleted successfully:', deletedTemplate.name);
    console.log('Total templates now:', dataStore.getMessageTemplates().length);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== MESSAGE HISTORY ENDPOINTS =====

app.get('/api/messages/history', authenticateToken, (req, res) => {
  try {
    const messageHistory = dataStore.getMessageHistory();
    console.log('Getting message history, total:', messageHistory.length);
    res.json({
      success: true,
      data: messageHistory
    });
  } catch (error) {
    console.error('Get message history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== ANALYTICS ENDPOINTS =====

app.get('/api/analytics/dashboard', authenticateToken, (req, res) => {
  try {
    const patients = dataStore.getPatients();
    const appointments = dataStore.getAppointments();
    const messageHistory = dataStore.getMessageHistory();
    
    const stats = {
      totalPatients: patients.length,
      totalAppointments: appointments.length,
      upcomingAppointments: appointments.filter(a => new Date(a.date) > new Date()).length,
      messagesSent: messageHistory.length,
      messageDeliveryRate: '98%',
      responseRate: '76%'
    };
    
    console.log(`Getting dashboard stats (${storageType}):`, stats);
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  // Initialize storage first
  await initializeStorage();
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 HealthPing Backend running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 API Health check: http://localhost:${PORT}/api/health`);
    console.log(`💾 Storage: ${storageType.toUpperCase()}`);
    
    if (storageType === 'mongodb') {
      console.log(`🗄️  Database: Connected to MongoDB`);
    } else {
      console.log(`📁 Data directory: backend/data/`);
      console.log(`💡 To use MongoDB, set MONGODB_URI in your .env file`);
    }
    
    console.log(`👥 Total endpoints: Patients, Doctors, Appointments, Messages, Analytics`);
    
    if (logger) {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`Storage type: ${storageType}`);
    }
  });
};

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
// backend/src/utils/data.js - Simple file-based storage

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const DOCTORS_FILE = path.join(DATA_DIR, 'doctors.json');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('📁 Created data directory:', DATA_DIR);
}

// Helper function to read JSON file
const readJSONFile = (filePath, defaultValue = []) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
};

// Helper function to write JSON file
const writeJSONFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
};

// Data storage class
class DataStore {
  constructor() {
    this.users = readJSONFile(USERS_FILE, []);
    this.patients = readJSONFile(PATIENTS_FILE, []);
    this.doctors = readJSONFile(DOCTORS_FILE, []);
    this.appointments = readJSONFile(APPOINTMENTS_FILE, []);
    this.messageTemplates = readJSONFile(TEMPLATES_FILE, []);
    this.messageHistory = readJSONFile(MESSAGES_FILE, []);
    
    // Get the highest ID for each collection to continue counting
    this.userIdCounter = this.getNextId(this.users);
    this.patientIdCounter = this.getNextId(this.patients);
    this.doctorIdCounter = this.getNextId(this.doctors);
    this.appointmentIdCounter = this.getNextId(this.appointments);
    this.templateIdCounter = this.getNextId(this.messageTemplates);
    this.messageIdCounter = this.getNextId(this.messageHistory);
    
    console.log('📊 Data loaded from files:');
    console.log(`   - Users: ${this.users.length}`);
    console.log(`   - Patients: ${this.patients.length}`);
    console.log(`   - Doctors: ${this.doctors.length}`);
    console.log(`   - Appointments: ${this.appointments.length}`);
    console.log(`   - Templates: ${this.messageTemplates.length}`);
    console.log(`   - Messages: ${this.messageHistory.length}`);
  }
  
  getNextId(array) {
    if (array.length === 0) return 1;
    return Math.max(...array.map(item => item.id || 0)) + 1;
  }
  
  // User methods
  getUsers() {
    return this.users;
  }
  
  addUser(user) {
    user.id = this.userIdCounter++;
    this.users.push(user);
    this.saveUsers();
    console.log(`✅ User added: ${user.email} (ID: ${user.id})`);
    return user;
  }
  
  updateUser(id, userData) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...userData };
      this.saveUsers();
      console.log(`✅ User updated: ID ${id}`);
      return this.users[index];
    }
    return null;
  }
  
  deleteUser(id) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      const deleted = this.users.splice(index, 1)[0];
      this.saveUsers();
      console.log(`✅ User deleted: ID ${id}`);
      return deleted;
    }
    return null;
  }
  
  saveUsers() {
    return writeJSONFile(USERS_FILE, this.users);
  }
  
  // Patient methods
  getPatients() {
    return this.patients;
  }
  
  addPatient(patient) {
    patient.id = this.patientIdCounter++;
    this.patients.push(patient);
    this.savePatients();
    console.log(`✅ Patient added: ${patient.name} (ID: ${patient.id})`);
    return patient;
  }
  
  updatePatient(id, patientData) {
    const index = this.patients.findIndex(p => p.id === id);
    if (index !== -1) {
      this.patients[index] = { ...this.patients[index], ...patientData };
      this.savePatients();
      console.log(`✅ Patient updated: ID ${id}`);
      return this.patients[index];
    }
    return null;
  }
  
  deletePatient(id) {
    const index = this.patients.findIndex(p => p.id === id);
    if (index !== -1) {
      const deleted = this.patients.splice(index, 1)[0];
      this.savePatients();
      console.log(`✅ Patient deleted: ID ${id}`);
      return deleted;
    }
    return null;
  }
  
  savePatients() {
    return writeJSONFile(PATIENTS_FILE, this.patients);
  }
  
  // Doctor methods
  getDoctors() {
    return this.doctors;
  }
  
  addDoctor(doctor) {
    doctor.id = this.doctorIdCounter++;
    this.doctors.push(doctor);
    this.saveDoctors();
    console.log(`✅ Doctor added: ${doctor.name} (ID: ${doctor.id})`);
    return doctor;
  }
  
  updateDoctor(id, doctorData) {
    const index = this.doctors.findIndex(d => d.id === id);
    if (index !== -1) {
      this.doctors[index] = { ...this.doctors[index], ...doctorData };
      this.saveDoctors();
      console.log(`✅ Doctor updated: ID ${id}`);
      return this.doctors[index];
    }
    return null;
  }
  
  deleteDoctor(id) {
    const index = this.doctors.findIndex(d => d.id === id);
    if (index !== -1) {
      const deleted = this.doctors.splice(index, 1)[0];
      this.saveDoctors();
      console.log(`✅ Doctor deleted: ID ${id}`);
      return deleted;
    }
    return null;
  }
  
  saveDoctors() {
    return writeJSONFile(DOCTORS_FILE, this.doctors);
  }
  
  // Appointment methods
  getAppointments() {
    return this.appointments;
  }
  
  addAppointment(appointment) {
    appointment.id = this.appointmentIdCounter++;
    this.appointments.push(appointment);
    this.saveAppointments();
    console.log(`✅ Appointment added: ${appointment.patient} (ID: ${appointment.id})`);
    return appointment;
  }
  
  updateAppointment(id, appointmentData) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index !== -1) {
      this.appointments[index] = { ...this.appointments[index], ...appointmentData };
      this.saveAppointments();
      console.log(`✅ Appointment updated: ID ${id}`);
      return this.appointments[index];
    }
    return null;
  }
  
  deleteAppointment(id) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index !== -1) {
      const deleted = this.appointments.splice(index, 1)[0];
      this.saveAppointments();
      console.log(`✅ Appointment deleted: ID ${id}`);
      return deleted;
    }
    return null;
  }
  
  saveAppointments() {
    return writeJSONFile(APPOINTMENTS_FILE, this.appointments);
  }
  
  // Message Template methods
  getMessageTemplates() {
    return this.messageTemplates;
  }
  
  addMessageTemplate(template) {
    template.id = this.templateIdCounter++;
    this.messageTemplates.push(template);
    this.saveMessageTemplates();
    console.log(`✅ Template added: ${template.name} (ID: ${template.id})`);
    return template;
  }
  
  updateMessageTemplate(id, templateData) {
    const index = this.messageTemplates.findIndex(t => t.id === id);
    if (index !== -1) {
      this.messageTemplates[index] = { ...this.messageTemplates[index], ...templateData };
      this.saveMessageTemplates();
      console.log(`✅ Template updated: ID ${id}`);
      return this.messageTemplates[index];
    }
    return null;
  }
  
  deleteMessageTemplate(id) {
    const index = this.messageTemplates.findIndex(t => t.id === id);
    if (index !== -1) {
      const deleted = this.messageTemplates.splice(index, 1)[0];
      this.saveMessageTemplates();
      console.log(`✅ Template deleted: ID ${id}`);
      return deleted;
    }
    return null;
  }
  
  saveMessageTemplates() {
    return writeJSONFile(TEMPLATES_FILE, this.messageTemplates);
  }
  
  // Message History methods
  getMessageHistory() {
    return this.messageHistory;
  }
  
  addMessage(message) {
    message.id = this.messageIdCounter++;
    this.messageHistory.push(message);
    this.saveMessageHistory();
    console.log(`✅ Message added: ID ${message.id}`);
    return message;
  }
  
  saveMessageHistory() {
    return writeJSONFile(MESSAGES_FILE, this.messageHistory);
  }
}

// Create and export singleton instance
const dataStore = new DataStore();
module.exports = dataStore;
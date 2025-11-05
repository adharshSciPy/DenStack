// ================================
// controller/notificationController.js
// ================================
import axios from "axios";
import dotenv from "dotenv";
import NotificationLog from "../model/notificationModel.js";
import MessageTemplate from "../model/messageTemplateModel.js";
import notificationService from "../controller/notificationService.js";

dotenv.config();

const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL;
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

// ================================
// 1. SEND APPOINTMENT CONFIRMATION
// ================================
export const sendAppointmentConfirmation = async (req, res) => {
  try {
    const { appointmentId, clinicId, patientId, doctorId, appointmentDate, appointmentTime, opNumber } = req.body;
    
    // Validate inputs
    if (!appointmentId || !clinicId || !patientId || !appointmentDate || !appointmentTime || !opNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }
    
    // Fetch patient details
    const patientRes = await axios.post(`${PATIENT_SERVICE_BASE_URL}/patient/verify`, {
      clinicId,
      patientId
    });
    const patient = patientRes.data?.data;
    
    if (!patient || !patient.phone) {
      return res.status(404).json({
        success: false,
        message: "Patient phone not available"
      });
    }
    
    // Fetch clinic details
    let clinicName = "Our Clinic";
    try {
      const clinicRes = await axios.get(`${CLINIC_SERVICE_BASE_URL}/view-clinic/${clinicId}`);
      clinicName = clinicRes.data?.data?.name || clinicName;
    } catch (err) {
      console.warn("Could not fetch clinic name:", err.message);
    }
    
    // Get or create template
    let template = await MessageTemplate.findOne({
      clinicId,
      type: "appointment_confirmation",
      channel: "sms",
      isActive: true
    });
    
    if (!template) {
      template = await notificationService.createDefaultTemplate(clinicId, "appointment_confirmation", "sms");
    }
    
    // Replace variables
    const message = notificationService.replaceVariables(template.body, {
      patientName: patient.name,
      appointmentDate,
      appointmentTime,
      opNumber,
      clinicName
    });
    
    // Create notification log
    const notification = new NotificationLog({
      clinicId,
      patientId,
      appointmentId,
      type: "appointment_confirmation",
      channel: "sms",
      recipient: {
        phone: patient.phone,
        name: patient.name,
        email: patient.email
      },
      message,
      templateId: template._id,
      status: "pending"
    });
    
    await notification.save();
    
    // Send SMS
    await notificationService.sendSMS(notification);
    
    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: notification
    });
    
  } catch (error) {
    console.error("❌ Error in sendAppointmentConfirmation:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending notification",
      error: error.message
    });
  }
};

// ================================
// 2. SEND APPOINTMENT REMINDER
// ================================
export const sendAppointmentReminder = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "appointmentId is required"
      });
    }
    
    // Fetch appointment details (call your appointment service)
    const appointmentRes = await axios.get(`${PATIENT_SERVICE_BASE_URL}/appointment/${appointmentId}`);
    const appointment = appointmentRes.data?.appointment;
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }
    
    const { clinicId, patientId, appointmentDate, appointmentTime, opNumber } = appointment;
    
    // Fetch patient details
    const patientRes = await axios.post(`${PATIENT_SERVICE_BASE_URL}/patient/verify`, {
      clinicId,
      patientId
    });
    const patient = patientRes.data?.data;
    
    if (!patient?.phone) {
      return res.status(404).json({
        success: false,
        message: "Patient phone not available"
      });
    }
    
    // Fetch clinic name
    let clinicName = "Our Clinic";
    try {
      const clinicRes = await axios.get(`${CLINIC_SERVICE_BASE_URL}/view-clinic/${clinicId}`);
      clinicName = clinicRes.data?.data?.name || clinicName;
    } catch (err) {
      console.warn("Could not fetch clinic name");
    }
    
    // Get template
    let template = await MessageTemplate.findOne({
      clinicId,
      type: "appointment_reminder",
      channel: "sms",
      isActive: true
    });
    
    if (!template) {
      template = await notificationService.createDefaultTemplate(clinicId, "appointment_reminder", "sms");
    }
    
    const message = notificationService.replaceVariables(template.body, {
      patientName: patient.name,
      appointmentDate,
      appointmentTime,
      opNumber,
      clinicName
    });
    
    // Create notification log
    const notification = new NotificationLog({
      clinicId,
      patientId,
      appointmentId,
      type: "appointment_reminder",
      channel: "sms",
      recipient: {
        phone: patient.phone,
        name: patient.name
      },
      message,
      templateId: template._id,
      status: "pending"
    });
    
    await notification.save();
    await notificationService.sendSMS(notification);
    
    return res.status(200).json({
      success: true,
      message: "Reminder sent successfully",
      data: notification
    });
    
  } catch (error) {
    console.error("❌ Error in sendAppointmentReminder:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending reminder",
      error: error.message
    });
  }
};

// ================================
// 3. SEND TOKEN READY NOTIFICATION
// ================================
export const sendTokenReadyNotification = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "appointmentId is required"
      });
    }
    
    // Fetch appointment
    const appointmentRes = await axios.get(`${PATIENT_SERVICE_BASE_URL}/appointment/${appointmentId}`);
    const appointment = appointmentRes.data?.appointment;
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }
    
    const { clinicId, patientId, opNumber } = appointment;
    
    // Fetch patient
    const patientRes = await axios.post(`${PATIENT_SERVICE_BASE_URL}/patient/verify`, {
      clinicId,
      patientId
    });
    const patient = patientRes.data?.data;
    
    if (!patient?.phone) {
      return res.status(404).json({
        success: false,
        message: "Patient phone not available"
      });
    }
    
    // Fetch clinic name
    let clinicName = "Our Clinic";
    try {
      const clinicRes = await axios.get(`${CLINIC_SERVICE_BASE_URL}/view-clinic/${clinicId}`);
      clinicName = clinicRes.data?.data?.name || clinicName;
    } catch (err) {
      console.warn("Could not fetch clinic name");
    }
    
    // Get template
    let template = await MessageTemplate.findOne({
      clinicId,
      type: "token_ready",
      channel: "sms",
      isActive: true
    });
    
    if (!template) {
      template = await notificationService.createDefaultTemplate(clinicId, "token_ready", "sms");
    }
    
    const message = notificationService.replaceVariables(template.body, {
      patientName: patient.name,
      opNumber,
      clinicName
    });
    
    // Create notification log
    const notification = new NotificationLog({
      clinicId,
      patientId,
      appointmentId,
      type: "token_ready",
      channel: "sms",
      recipient: {
        phone: patient.phone,
        name: patient.name
      },
      message,
      templateId: template._id,
      status: "pending"
    });
    
    await notification.save();
    await notificationService.sendSMS(notification);
    
    return res.status(200).json({
      success: true,
      message: "Token notification sent successfully",
      data: notification
    });
    
  } catch (error) {
    console.error("❌ Error in sendTokenReadyNotification:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending token notification",
      error: error.message
    });
  }
};

// ================================
// 4. GET NOTIFICATION LOGS
// ================================
export const getNotificationLogs = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { limit = 50, page = 1, status, type } = req.query;
    
    const query = { clinicId };
    if (status) query.status = status;
    if (type) query.type = type;
    
    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await NotificationLog.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: logs,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching logs",
      error: error.message
    });
  }
};

// ================================
// 5. GET TEMPLATES
// ================================
export const getTemplates = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const templates = await MessageTemplate.find({ clinicId, isActive: true });
    
    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ================================
// 6. CREATE TEMPLATE
// ================================
export const createTemplate = async (req, res) => {
  try {
    const template = new MessageTemplate(req.body);
    await template.save();
    
    return res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
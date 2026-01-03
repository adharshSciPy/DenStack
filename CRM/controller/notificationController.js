// ================================
// controller/notificationController.js (FIXED - No /patient/verify)
// ================================
import axios from "axios";
import dotenv from "dotenv";
import NotificationLog from "../model/notificationModel.js";
import MessageTemplate from "../model/messageTemplateModel.js";
import notificationService from "../services/notificationService.js"; 
import InAppNotificationService from "../services/InAppNotificationService.js";
import { processBirthdayWishes, sendTestBirthdayWishToPatient } from '../utils/birthdayScheduler.js';

dotenv.config();

const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL;
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;

// ================================
// BIRTHDAY FUNCTIONS
// ================================
export const triggerBirthdayWishes = async (req, res) => {
  try {
    console.log('🎂 [API] Manual birthday trigger requested');
    
    const result = await processBirthdayWishes();
    
    return res.status(200).json({
      success: true,
      message: 'Birthday wishes processing completed',
      data: result
    });
  } catch (error) {
    console.error('❌ Error in triggerBirthdayWishes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending birthday wishes',
      error: error.message
    });
  }
};

export const sendTestBirthdayWish = async (req, res) => {
  try {
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required'
      });
    }
    
    const result = await sendTestBirthdayWishToPatient(patientId);
    
    return res.status(200).json({
      success: true,
      message: 'Test birthday wish sent',
      data: result
    });
  } catch (error) {
    console.error('❌ Error in sendTestBirthdayWish:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending test birthday wish',
      error: error.message
    });
  }
};


export const getUpcomingBirthdays = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { days = 7 } = req.query;
    
    // ✅ Fetch via API instead of database
    const response = await axios.get(
      `${PATIENT_SERVICE_BASE_URL}/api/v1/patient-service/patient/clinic-patients/${clinicId}`
    );
    
    const patients = response.data?.data || [];
    const today = new Date();
    
    // Calculate upcoming birthdays
    const upcomingBirthdays = patients
      .filter(p => p.dateOfBirth)
      .map(patient => {
        const dob = new Date(patient.dateOfBirth);
        const thisYearBirthday = new Date(
          today.getFullYear(),
          dob.getMonth(),
          dob.getDate()
        );
        
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        
        const daysUntil = Math.ceil(
          (thisYearBirthday - today) / (1000 * 60 * 60 * 24)
        );
        
        return {
          _id: patient._id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          patientUniqueId: patient.patientUniqueId,
          dateOfBirth: patient.dateOfBirth,
          birthdayDate: thisYearBirthday,
          daysUntil
        };
      })
      .filter(p => p.daysUntil >= 0 && p.daysUntil <= parseInt(days))
      .sort((a, b) => a.daysUntil - b.daysUntil);
    
    return res.status(200).json({
      success: true,
      data: upcomingBirthdays,
      count: upcomingBirthdays.length
    });
  } catch (error) {
    console.error('❌ Error in getUpcomingBirthdays:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching upcoming birthdays',
      error: error.message
    });
  }
};


const getPatientDetails = async (clinicId, patientId) => {
  try {
    console.log(`🔍 [DEBUG] Fetching patient ${patientId} from clinic ${clinicId}`);
    
    // ✅ Try method 1: Get all clinic patients and filter
    const endpoint = `${PATIENT_SERVICE_BASE_URL}/api/v1/patient-service/patient/clinic-patients/${clinicId}`;
    console.log(`🔍 [DEBUG] Using: ${endpoint}`);
    
    const response = await axios.get(endpoint);
    
    console.log(`✅ [DEBUG] Response status: ${response.status}`);
    const patients = response.data?.data || response.data?.patients || [];
    console.log(`✅ [DEBUG] Found ${patients.length} patients in clinic`);
    
    const patient = patients.find(p => p._id?.toString() === patientId.toString());
    
    if (patient) {
      console.log(`✅ [DEBUG] Patient found: ${patient.name}, Phone: ${patient.phone}`);
      return patient;
    }
    
    console.log(`⚠️  [DEBUG] Patient ${patientId} not found in clinic patients list`);
    throw new Error("Patient not found in this clinic");
    
  } catch (err) {
    console.error("❌ [DEBUG] Patient fetch failed:", err.message);
    throw new Error("Patient not found or not accessible");
  }
};
 export const getDoctorDetails = async (doctorId) => {
   try {
    console.log(`🔍 [DEBUG] Fetching doctor ${doctorId}`);
    
    const endpoint = `${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`;
    console.log(`🔍 [DEBUG] Using: ${endpoint}`);
    
    const response = await axios.get(endpoint);
    
    console.log(`✅ [DEBUG] Response status: ${response.status}`);
    const doctor = response.data?.data;
    
    if (doctor) {
      console.log(`✅ [DEBUG] Doctor found: ${doctor.name}, Email: ${doctor.email}`);
      return doctor;
    }
    
    console.log(`⚠️ [DEBUG] Doctor ${doctorId} not found`);
    return null;
    
  } catch (err) {
    console.error("❌ [DEBUG] Doctor fetch failed:", err.message);
    return null;
  }
};


// Replace your sendAppointmentConfirmation function with this:
export const sendAppointmentConfirmation = async (req, res) => {
  try {
    const { 
      appointmentId, 
      clinicId, 
      patientId, 
      doctorId,
      appointmentDate, 
      appointmentTime, 
      opNumber,
      clinicName: providedClinicName
    } = req.body;
    
    // Validate inputs
    if (!appointmentId || !clinicId || !patientId || !appointmentDate || !appointmentTime || !opNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }
    
    console.log(`📤 [NOTIFICATION] Processing appointment confirmation for OP#${opNumber}`);
    
    // Fetch patient details
    const patient = await getPatientDetails(clinicId, patientId);
    
    if (!patient || !patient.email) {
      return res.status(404).json({
        success: false,
        message: "Patient email not available"
      });
    }
    
    console.log(`✅ [NOTIFICATION] Patient found: ${patient.name} (${patient.email})`);
    
    // Use provided clinic name
    const clinicName = providedClinicName || "Our Clinic";
    console.log(`✅ Using clinic name: ${clinicName}`);
    
    // ================================
    // 1. SEND PATIENT EMAIL CONFIRMATION
    // ================================
    
    let patientTemplate = await MessageTemplate.findOne({
      clinicId,
      type: "appointment_confirmation",
      channel: "email",
      isActive: true
    });
    
    if (!patientTemplate) {
      patientTemplate = await notificationService.createDefaultTemplate(
        clinicId, 
        "appointment_confirmation", 
        "email"
      );
    }
    
    const patientMessage = notificationService.replaceVariables(patientTemplate.body, {
      patientName: patient.name,
      appointmentDate,
      appointmentTime,
      opNumber,
      clinicName
    });
    
    const patientSubject = patientTemplate.subject ? 
      notificationService.replaceVariables(patientTemplate.subject, {
        patientName: patient.name,
        appointmentDate,
        appointmentTime,
        opNumber,
        clinicName
      }) : "Appointment Confirmation";
    
    const patientNotification = new NotificationLog({
      clinicId,
      patientId,
      appointmentId,
      type: "appointment_confirmation",
      channel: "email",
      recipient: {
        phone: patient.phone,
        name: patient.name,
        email: patient.email
      },
      message: patientMessage,
      subject: patientSubject,
      templateId: patientTemplate._id,
      status: "pending"
    });
    
    await patientNotification.save();
    await notificationService.sendEmail(patientNotification);
    console.log(`✅ [NOTIFICATION] Patient confirmation sent to ${patient.email}`);
    
    // ================================
    // 2. CREATE IN-APP NOTIFICATION FOR PATIENT (if they have an account)
    // ================================
    // Note: Only create if patient has userId (registered account)
    // You might need to check if patient has a userId field
    // For now, skipping patient in-app notification since patients typically don't have app access
    
    // ================================
    // 3. SEND DOCTOR EMAIL & IN-APP NOTIFICATION
    // ================================
    
    let doctorNotified = false;
    
    if (doctorId) {
      try {
        const doctor = await getDoctorDetails(doctorId);
        
        if (doctor && doctor.email) {
          console.log(`📤 [NOTIFICATION] Sending to doctor: ${doctor.name} (${doctor.email})`);
          
          // EMAIL NOTIFICATION
          let doctorTemplate = await MessageTemplate.findOne({
            clinicId,
            type: "doctor_notification",
            channel: "email",
            isActive: true
          });
          
          if (!doctorTemplate) {
            doctorTemplate = await notificationService.createDefaultTemplate(
              clinicId, 
              "doctor_notification", 
              "email"
            );
          }
          
          const doctorMessage = notificationService.replaceVariables(doctorTemplate.body, {
            doctorName: doctor.name,
            patientName: patient.name,
            appointmentDate,
            appointmentTime,
            opNumber,
            clinicName
          });
          
          const doctorSubject = doctorTemplate.subject ? 
            notificationService.replaceVariables(doctorTemplate.subject, {
              doctorName: doctor.name,
              patientName: patient.name,
              appointmentDate,
              appointmentTime,
              opNumber,
              clinicName
            }) : "New Appointment Scheduled";
          
          const doctorNotification = new NotificationLog({
            clinicId,
            patientId,
            appointmentId,
            type: "doctor_notification",
            channel: "email",
            recipient: {
              name: doctor.name,
              email: doctor.email
            },
            message: doctorMessage,
            subject: doctorSubject,
            templateId: doctorTemplate._id,
            status: "pending"
          });
          
          await doctorNotification.save();
          await notificationService.sendEmail(doctorNotification);
          console.log(`✅ [NOTIFICATION] Doctor email sent to ${doctor.email}`);
          
          // ✅ IN-APP NOTIFICATION FOR DOCTOR
          try {
            await InAppNotificationService.createNotification({
              userId: doctorId,
              userRole: "doctor",
              type: "new_appointment",
              title: "New Appointment Scheduled",
              message: `New appointment with ${patient.name} on ${appointmentDate} at ${appointmentTime} (OP#${opNumber})`,
              appointmentId,
              patientId,
              clinicId,
              metadata: {
                patientName: patient.name,
                appointmentDate,
                appointmentTime,
                opNumber,
                clinicName
              }
            });
            console.log(`🔔 [NOTIFICATION] In-app notification created for doctor ${doctorId}`);
          } catch (inAppError) {
            console.error(`⚠️ [NOTIFICATION] Failed to create in-app notification:`, inAppError.message);
          }
          
          doctorNotified = true;
        } else {
          console.warn(`⚠️ [NOTIFICATION] Doctor email not available for doctor ${doctorId}`);
        }
      } catch (doctorError) {
        console.error(`⚠️ [NOTIFICATION] Failed to send doctor notification:`, doctorError.message);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Notifications sent successfully",
      data: {
        patientNotification,
        doctorNotified
      }
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
// 2. SEND APPOINTMENT REMINDER (EMAIL VERSION)
// ================================
export const sendAppointmentReminder = async (req, res) => {
  try {
    const { 
      appointmentId,
      clinicId,
      patientId, 
      appointmentDate,
      appointmentTime,
      opNumber,
      clinicName: providedClinicName
    } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "appointmentId is required"
      });
    }
    
    if (!clinicId || !patientId || !appointmentDate || !appointmentTime || !opNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required appointment data"
      });
    }
    
    console.log(`📤 [REMINDER] Processing reminder for OP#${opNumber}`);
    console.log(`📤 [REMINDER] Fetching patient ${patientId} from clinic ${clinicId}`);
    
    // Fetch patient details
    const patient = await getPatientDetails(clinicId, patientId);
    
    if (!patient?.email) {  // ✅ Check for EMAIL not phone
      return res.status(404).json({
        success: false,
        message: "Patient email not available"
      });
    }
    
    console.log(`✅ [REMINDER] Patient found: ${patient.name} (${patient.email})`);
    
    // Use provided clinic name
    const clinicName = providedClinicName || "Our Clinic";
    console.log(`✅ [REMINDER] Using clinic name: ${clinicName}`);
    
    // Get EMAIL template for reminders
    let template = await MessageTemplate.findOne({
      clinicId,
      type: "appointment_reminder",
      channel: "email",  // ✅ EMAIL not SMS
      isActive: true
    });
    
    if (!template) {
      template = await notificationService.createDefaultTemplate(clinicId, "appointment_reminder", "email");  // ✅ EMAIL
    }
    
    const message = notificationService.replaceVariables(template.body, {
      patientName: patient.name,
      appointmentDate,
      appointmentTime,
      opNumber,
      clinicName
    });
    
    const subject = template.subject ? notificationService.replaceVariables(template.subject, {
      patientName: patient.name,
      appointmentDate,
      appointmentTime,
      opNumber,
      clinicName
    }) : "Appointment Reminder";  // ✅ Add subject
    
    // Create notification log
    const notification = new NotificationLog({
      clinicId,
      patientId,
      appointmentId,
      type: "appointment_reminder",
      channel: "email",  // ✅ EMAIL not SMS
      recipient: {
        phone: patient.phone,
        name: patient.name,
        email: patient.email  // ✅ Add email
      },
      message,
      subject,  // ✅ Add subject
      templateId: template._id,
      status: "pending"
    });
    
    await notification.save();
    
    // ✅ SEND EMAIL (not SMS)
    console.log(`📧 [REMINDER] Sending email to: ${patient.email}`);
    await notificationService.sendEmail(notification);  // ✅ sendEmail not sendSMS
    
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
// 3. SEND TOKEN READY NOTIFICATION (FIXED)
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
    const appointmentRes = await axios.get(`${PATIENT_SERVICE_BASE_URL}/appointment/fetch/${appointmentId}`);
    const appointment = appointmentRes.data?.appointment || appointmentRes.data?.data;
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }
    
    const { clinicId, patientId, opNumber } = appointment;
    
    // Fetch patient using corrected method
    const patient = await getPatientDetails(clinicId, patientId);
    
    if (!patient?.phone) {
      return res.status(404).json({
        success: false,
        message: "Patient phone not available"
      });
    }
    
    // Fetch clinic name (from Auth Service)
    let clinicName = "Our Clinic";
    try {
      const clinicRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/view-clinic/${clinicId}`);
      clinicName = clinicRes.data?.data?.name || clinicRes.data?.name || clinicName;
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
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";
import notificationModel from "../model/notificationModel.js";
import MessageTemplate from "../model/messageTemplateModel.js";
import notificationService from "../services/notificationService.js";

dotenv.config();

const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL || "http://localhost:8002";

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Get today's month and day
 */
const getTodayMonthDay = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    day: now.getDate()
  };
};

/**
 * Fetch all patients and find today's birthdays
 */
const findTodaysBirthdays = async () => {
  try {
    const { month, day } = getTodayMonthDay();
    
    console.log(`🎂 [BIRTHDAY] Checking for birthdays on ${month}/${day}`);
    
    // ✅ Fetch all patients using your existing API
    // We'll need to fetch from all clinics, so we'll make multiple requests
    // First, let's try to get all patients without clinic filter
    
    let allPatients = [];
    
    // Since your API is paginated by clinic, we need a different approach
    // For now, we'll fetch patients who have birthdays today by checking each response
    
    // You might need to add a new endpoint OR we can work with what we have
    // Let's use the existing getPatientById and getPatientsByClinic endpoints
    
    // OPTION 1: If you can add a simple endpoint to return all patients with DOB
    // For now, let's return empty and suggest creating the endpoint
    
    console.warn(`⚠️ [BIRTHDAY] Need to fetch patients across all clinics`);
    console.warn(`⚠️ [BIRTHDAY] Please add this endpoint to patient-service:`);
    console.warn(`   GET /api/v1/patient-service/patient/all-with-birthdays`);
    console.warn(`   Should return: all patients with dateOfBirth field`);
    
    // Temporary: Return empty array
    // When you add the endpoint, uncomment below:
    
    /*
    const response = await axios.get(
      `${PATIENT_SERVICE_BASE_URL}/api/v1/patient-service/patient/all-with-birthdays`
    );
    allPatients = response.data?.data || [];
    */
    
    // Filter patients with today's birthday
    const birthdayPatients = allPatients.filter(patient => {
      if (!patient.dateOfBirth) return false;
      
      const dob = new Date(patient.dateOfBirth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    console.log(`🎂 [BIRTHDAY] Found ${birthdayPatients.length} patients with birthdays today`);
    return birthdayPatients;
    
  } catch (error) {
    console.error('❌ [BIRTHDAY] Error finding birthdays:', error.message);
    return [];
  }
};

/**
 * Fetch patient by ID using your existing API
 */
const getPatientById = async (patientId) => {
  try {
    console.log(`🔍 [BIRTHDAY] Fetching patient: ${patientId}`);
    
    // ✅ Using your actual route: /details/:id
    const endpoint = `${PATIENT_SERVICE_BASE_URL}/api/v1/patient-service/patient/details/${patientId}`;
    console.log(`🔍 [BIRTHDAY] Using endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint);
    
    console.log(`✅ [BIRTHDAY] Patient fetch response:`, response.data);
    
    return response.data?.data || response.data?.patient || null;
  } catch (error) {
    console.error(`❌ [BIRTHDAY] Error fetching patient ${patientId}:`, error.message);
    if (error.response) {
      console.error(`❌ [BIRTHDAY] Response status:`, error.response.status);
      console.error(`❌ [BIRTHDAY] Response data:`, error.response.data);
    }
    return null;
  }
};

/**
 * Send birthday message to a single patient
 */
const sendBirthdayMessage = async (patient) => {
  const { _id: patientId, name, phone, email, clinicId } = patient;

  try {
    console.log(`🎂 [BIRTHDAY] Processing wish for ${name} (${phone || email})`);

    // Check if birthday wish already sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const alreadySent = await notificationModel.findOne({
      patientId,
      type: 'birthday_wish',
      status: { $in: ['sent', 'delivered'] },
      createdAt: { $gte: todayStart }
    });

    if (alreadySent) {
      console.log(`⏭️  [BIRTHDAY] Birthday wish already sent to ${name}`);
      return { skipped: true };
    }

    // Get or create birthday template
    let template = await MessageTemplate.findOne({
      clinicId,
      type: 'birthday_wish',
      channel: 'sms',
      isActive: true
    });

    if (!template) {
      template = await notificationService.createDefaultTemplate(
        clinicId,
        'birthday_wish',
        'sms'
      );
    }

    // Replace variables in template
    const message = notificationService.replaceVariables(template.body, {
      patientName: name,
      clinicName: 'Our Clinic'
    });

    // Create notification log
    const notification = new notificationModel({
      clinicId,
      patientId,
      type: 'birthday_wish',
      channel: 'sms',
      recipient: {
        phone: phone,
        name: name,
        email: email
      },
      message,
      templateId: template._id,
      status: 'pending'
    });

    await notification.save();

    // Send SMS
    if (phone) {
      await notificationService.sendSMS(notification);
      console.log(`✅ [BIRTHDAY] SMS sent to ${name} at ${phone}`);
      return { sent: true };
    } else {
      console.warn(`⚠️ [BIRTHDAY] No phone number for ${name}`);
      notification.status = 'failed';
      notification.error = 'No phone number available';
      await notification.save();
      return { failed: true };
    }
    
  } catch (error) {
    console.error(`❌ [BIRTHDAY] Error sending to ${name}:`, error.message);
    return { failed: true };
  }
};

/**
 * Process all birthday wishes for today
 * EXPORTED for manual triggers
 */
export const processBirthdayWishes = async () => {
  try {
    console.log("🎂 [BIRTHDAY] Starting birthday wish processor...");
    
    const birthdayPatients = await findTodaysBirthdays();
    
    if (birthdayPatients.length === 0) {
      console.log('✅ [BIRTHDAY] No birthdays today');
      return { success: true, sent: 0, skipped: 0, failed: 0 };
    }

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const patient of birthdayPatients) {
      const result = await sendBirthdayMessage(patient);
      
      if (result.sent) sentCount++;
      else if (result.skipped) skippedCount++;
      else if (result.failed) failedCount++;
    }

    console.log(`🎉 [BIRTHDAY] Completed - Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
    
    return {
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      total: birthdayPatients.length
    };
    
  } catch (error) {
    console.error('❌ [BIRTHDAY] Error in processBirthdayWishes:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send test birthday wish to specific patient
 * EXPORTED for testing - Uses your existing getPatientById API
 */
export const sendTestBirthdayWishToPatient = async (patientId) => {
  try {
    // ✅ Fetch patient using your existing API
    const patient = await getPatientById(patientId);

    if (!patient) {
      throw new Error('Patient not found');
    }

    console.log(`🧪 [BIRTHDAY TEST] Sending test wish to ${patient.name}`);
    return await sendBirthdayMessage(patient);
    
  } catch (error) {
    console.error('❌ [BIRTHDAY TEST] Failed:', error.message);
    throw error;
  }
};

// ================================
// CRON JOB - Runs daily at 9:00 AM
// ================================
cron.schedule("0 9 * * *", async () => {
  await processBirthdayWishes();
});

console.log("🎂 Birthday scheduler initialized");
console.log("   📅 Birthday checker: Daily at 9:00 AM");
console.log("   ⚠️  Note: Add /all-with-birthdays endpoint for full functionality");
console.log("");

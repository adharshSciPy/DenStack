// ================================
// utils/scheduler.js (PRODUCTION MODE)
// ================================
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";
import notificationModel from "../model/notificationModel.js";

dotenv.config();

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:8011";
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL || "http://localhost:8002";

// ✅ PRODUCTION: Runs every hour and checks tomorrow's appointments
cron.schedule("0 * * * *", async () => {
  try {
    console.log("🔔 [SCHEDULER] Running appointment reminder checker...");
    
    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    
    console.log(`📅 [SCHEDULER] Checking appointments for: ${tomorrowStr} (tomorrow)`);
    
    // Fetch all appointments for tomorrow
    const appointmentUrl = `${PATIENT_SERVICE_BASE_URL}/api/v1/patient-service/appointment/by-date`;
    
    console.log(`📍 [SCHEDULER] Fetching from: ${appointmentUrl}?date=${tomorrowStr}`);
    
    const response = await axios.get(appointmentUrl, {
      params: { 
        date: tomorrowStr, 
        status: "scheduled" 
      }
    });
    
    const appointments = response.data?.data || [];
    
    console.log(`📋 [SCHEDULER] Found ${appointments.length} appointments for tomorrow`);
    
    if (appointments.length === 0) {
      console.log("✅ [SCHEDULER] No appointments to remind");
      return;
    }
    
    // Process each appointment
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    // ✅ Fetch clinic name once (assumes all appointments are from same clinic)
    let clinicName = "Our Clinic";
    if (appointments.length > 0) {
      const firstAppt = appointments[0];
      try {
        const clinicRes = await axios.get(`${process.env.AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${firstAppt.clinicId}`);
        clinicName = clinicRes.data?.data?.name || clinicRes.data?.name || "Our Clinic";
        console.log(`✅ [SCHEDULER] Clinic name: ${clinicName}`);
      } catch (err) {
        console.warn(`⚠️ [SCHEDULER] Could not fetch clinic name: ${err.message}`);
      }
    }
    
    for (const appt of appointments) {
      try {
        // Check if reminder already sent
        const reminderSent = await notificationModel.findOne({
          appointmentId: appt._id,
          type: "appointment_reminder",
          status: { $in: ["sent", "delivered"] }
        });
        
        if (reminderSent) {
          console.log(`⏭️  [SCHEDULER] Reminder already sent for OP#${appt.opNumber}`);
          skippedCount++;
          continue;
        }
        
        console.log(`📤 [SCHEDULER] Sending reminder for OP#${appt.opNumber} at ${appt.appointmentTime}`);
        
        // Send reminder with all appointment data
        await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/send-reminder`, {
          appointmentId: appt._id,
          clinicId: appt.clinicId,
          patientId: appt.patientId._id || appt.patientId,
          appointmentDate: appt.appointmentDate,
          appointmentTime: appt.appointmentTime,
          opNumber: appt.opNumber,
          clinicName
        });
        
        console.log(`✅ [SCHEDULER] Reminder sent for OP#${appt.opNumber}`);
        sentCount++;
        
      } catch (err) {
        console.error(`❌ [SCHEDULER] Failed to send reminder for appointment ${appt._id}:`, err.message);
        if (err.response) {
          console.error(`   Response: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
        }
        failedCount++;
      }
    }
    
    console.log(`🎉 [SCHEDULER] Reminder check completed - Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
    
  } catch (error) {
    console.error("❌ [SCHEDULER] Error in reminder scheduler:", error.message);
    if (error.response) {
      console.error("   Response status:", error.response.status);
      console.error("   Response data:", error.response.data);
    }
  }
});

// ✅ Cleanup job - runs daily at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("🧹 [SCHEDULER] Running cleanup job...");
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const result = await notificationModel.deleteMany({
      createdAt: { $lt: ninetyDaysAgo }
    });
    
    console.log(`✅ [SCHEDULER] Cleaned up ${result.deletedCount} old notification logs`);
    
  } catch (error) {
    console.error("❌ [SCHEDULER] Error in cleanup job:", error);
  }
});

console.log("⏰ Notification scheduler initialized");
console.log("   📅 Reminder checker: Every hour (checks tomorrow's appointments)");
console.log("   🧹 Cleanup job: Daily at midnight");
console.log("");
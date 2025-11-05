// ================================
// utils/scheduler.js (CORRECTED)
// ================================
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";
import NotificationLog from "../models/NotificationLog.js";

dotenv.config();

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:8011";
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL

cron.schedule("0 * * * *", async () => {
  try {
    console.log("🔔 [SCHEDULER] Running appointment reminder checker...");
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    
    console.log(`🗓️  [SCHEDULER] Checking appointments for: ${tomorrowStr}`);
    
    // 🆕 FETCH FROM YOUR PATIENT SERVICE API (not local DB)
    const response = await axios.get(`${PATIENT_SERVICE_BASE_URL}/appointments/by-date`, {
      params: { date: tomorrowStr, status: "scheduled" }
    });
    
    const appointments = response.data?.data || [];
    
    console.log(`📋 [SCHEDULER] Found ${appointments.length} appointments for tomorrow`);
    
    if (appointments.length === 0) {
      console.log("✅ [SCHEDULER] No appointments to remind");
      return;
    }
    
    for (const appt of appointments) {
      try {
        const reminderSent = await NotificationLog.findOne({
          appointmentId: appt._id,
          type: "appointment_reminder",
          status: { $in: ["sent", "delivered"] }
        });
        
        if (reminderSent) {
          console.log(`⏭️  [SCHEDULER] Reminder already sent for OP#${appt.opNumber}`);
          continue;
        }
        
        console.log(`📤 [SCHEDULER] Sending reminder for OP#${appt.opNumber}`);
        
        await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/send-reminder`, {
          appointmentId: appt._id
        });
        
        console.log(`✅ [SCHEDULER] Reminder sent for OP#${appt.opNumber}`);
        
      } catch (err) {
        console.error(`❌ [SCHEDULER] Failed to send reminder for appointment ${appt._id}:`, err.message);
      }
    }
    
    console.log("🎉 [SCHEDULER] Reminder check completed");
    
  } catch (error) {
    console.error("❌ [SCHEDULER] Error in reminder scheduler:", error);
  }
});

cron.schedule("0 0 * * *", async () => {
  try {
    console.log("🧹 [SCHEDULER] Running cleanup job...");
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const result = await NotificationLog.deleteMany({
      createdAt: { $lt: ninetyDaysAgo }
    });
    
    console.log(`✅ [SCHEDULER] Cleaned up ${result.deletedCount} old notification logs`);
    
  } catch (error) {
    console.error("❌ [SCHEDULER] Error in cleanup job:", error);
  }
});

console.log("⏰ Notification scheduler initialized");
console.log("   - Reminder checker: Every hour");
console.log("   - Cleanup job: Daily at midnight");
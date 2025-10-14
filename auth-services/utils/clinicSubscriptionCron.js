import cron from "node-cron";
import Clinic from "../models/clinicSchema.js";

export default function clinicSubscriptionCron() {
  // 🕐 Run every day at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();
      const result = await Clinic.updateMany(
        { "subscription.endDate": { $lt: now }, "subscription.isActive": true },
        { $set: { "subscription.isActive": false } }
      );

      if (result.modifiedCount > 0) {
        console.log(`✅ ${result.modifiedCount} clinic subscription(s) expired and deactivated`);
      } else {
        console.log("⏳ No expired subscriptions found this minute");
      }
    } catch (error) {
      console.error("❌ Error during subscription expiry check:", error.message);
    }
  });
}

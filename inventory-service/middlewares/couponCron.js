
import cron from "node-cron";
import Coupon from "../Model/CouponSchema.js";

// ─── Job: Auto-deactivate expired coupons ────────────────────────────────────
// Runs every day at midnight 00:00

async function deactivateExpiredCoupons() {
  try {
    const result = await Coupon.updateMany(
      { expiryDate: { $lte: new Date() }, isActive: true },
      { $set: { isActive: false } }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ [CouponCron] Deactivated ${result.modifiedCount} expired coupon(s)`);
    } else {
      console.log("✅ [CouponCron] No expired coupons to deactivate");
    }
  } catch (error) {
    console.error("❌ [CouponCron] Failed to deactivate expired coupons:", error.message);
  }
}

// ─── Register Cron Job ────────────────────────────────────────────────────────

const couponCron = () => {
  // Every day at midnight
  cron.schedule("0 0 * * *", () => {
    console.log("🕛 [CouponCron] Running: deactivate expired coupons...");
    deactivateExpiredCoupons();
  });

  console.log("✅ [CouponCron] Coupon cron job registered");
};

export default couponCron;
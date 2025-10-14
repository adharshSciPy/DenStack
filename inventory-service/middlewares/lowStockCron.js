import cron from "node-cron";
import Product from "../Model/ProductSchema.js";

export default function lowStockAlertsCron() {
    cron.schedule("0 0 * * *", async () => {
        try {
            const threshold = 10; // set as per your inventory policy

            // 1️⃣ Set isLowStock = true where stock < threshold
            const lowStockUpdated = await Product.updateMany(
                { stock: { $lt: threshold }, isLowStock: false },
                { $set: { isLowStock: true } }
            );

            // 2️⃣ Set isLowStock = false where stock ≥ threshold
            const normalStockUpdated = await Product.updateMany(
                { stock: { $gte: threshold }, isLowStock: true },
                { $set: { isLowStock: false } }
            );

            console.log(
                `✅ Low-stock cron job ran successfully: 
      Marked ${lowStockUpdated.modifiedCount} as low-stock, 
      ${normalStockUpdated.modifiedCount} back to normal.`
            );
        } catch (error) {
            console.error("❌ Error in low-stock flag cron job:", error.message);
        }
    });
}
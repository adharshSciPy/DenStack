import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import categoryRouter from "./routes/categoryRoute.js";
import clinicInventoryRouter from "./routes/clinicInventoryRoutes.js";
import clinicPurchaseRouter from "./routes/clinicPurchaseRoute.js";
import clinicDistributionRouter from "./routes/clinicDistributionRoutes.js";  

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});
app.use("/api/v1/clinic-inventory",categoryRouter)
app.use("/api/v1/clinic-inventory",clinicInventoryRouter)
app.use("/api/v1/clinic-purchase",clinicPurchaseRouter)
app.use("/api/v1/clinic-distribution",clinicDistributionRouter)



const PORT = process.env.PORT || 8008;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

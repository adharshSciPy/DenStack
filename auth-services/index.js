import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./mongoDB/connectDb.js";
import superAdminAuthRoutes from "./routes/superAdminRouter.js";
import superAdminDashboardRouter from "./routes/superAdminDashboardRouter.js";
import clinicAuthRoutes from "./routes/clinicRouter.js";
import doctorAuthRouter from "./routes/doctorRoute.js";
import nurseAuthRouter from "./routes/nurseRouter.js";
import pharmacistAuthRouter from "./routes/pharmacistRouter.js";
import accountantAuthRouter from "./routes/accountantRouter.js";
import technicianAuthRouter from "./routes/technicianRouter.js";
import receptionAuthRouter from "./routes/receptionRoute.js";
import PRORouter from "./routes/PRORouter.js";
import assistantRouter from "./routes/assistantRouter.js";
import clinicSubscriptionCron from "./utils/clinicSubscriptionCron.js";
import staffShiftCron from "./utils/staffShiftCron.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import EcommerceUserRoutes from "./routes/ecommerceuserRouter.js";

dotenv.config();
connectDB();

const app = express();

// Middleware
// app.use(cors());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4000'], // Add your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});
//cron jobs
clinicSubscriptionCron();
staffShiftCron();
app.use("/api/v1/auth/super-admin", superAdminAuthRoutes);
app.use("/api/v1/auth/clinic", clinicAuthRoutes);
app.use("/api/v1/auth/doctor", doctorAuthRouter);
app.use("/api/v1/auth/nurse", nurseAuthRouter);
app.use("/api/v1/auth/pharmacist", pharmacistAuthRouter);
app.use("/api/v1/auth/accountant", accountantAuthRouter);
app.use("/api/v1/auth/receptionist", receptionAuthRouter);
app.use("/api/v1/auth/technician", technicianAuthRouter);
app.use("/api/v1/auth/PRO", PRORouter);
app.use("/api/v1/auth/assistant", assistantRouter);
app.use("/api/v1/auth/roles", permissionRoutes);
app.use("/api/v1/super-admin", superAdminDashboardRouter);
app.use("/api/v1/ecommerceuser", EcommerceUserRoutes);

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

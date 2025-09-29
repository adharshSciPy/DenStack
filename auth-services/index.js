import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDb.js";
import superAdminAuthRoutes from "./routes/superAdminRouter.js";
import clinicAuthRoutes from "./routes/clinicRouter.js";
import doctorAuthRouter from "./routes/doctorRoute.js";
import nurseAuthRouter from "./routes/nurseRouter.js";
import pharmacistAuthRouter from "./routes/pharmacistRouter.js";

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

app.use("/api/v1/auth/super-admin", superAdminAuthRoutes)
app.use("/api/v1/auth/clinic", clinicAuthRoutes)
app.use("/api/v1/auth/doctor", doctorAuthRouter)
app.use("/api/v1/auth/nurse", nurseAuthRouter)
app.use("/api/v1/auth/pharmacist", pharmacistAuthRouter)


const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

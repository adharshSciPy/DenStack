import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDb.js";
import patientRegisterRouter from "./routes/patientRegisterRoutes.js";
import patientAppointmentRouter from "./routes/patientAppointmentRoute.js";
import doctorConsultationRouter from "./routes/doctorConsultationRoute.js";
import path from "path";
import fs from "fs"
import dentalRouter from "./routes/dentalChartRoute.js";


dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

app.use("/api/v1/patient-service/patient",patientRegisterRouter)
app.use("/api/v1/patient-service/appointment",patientAppointmentRouter)
app.use("/api/v1/patient-service/consultation",doctorConsultationRouter)
app.use("/api/v1/patient-service/dental",dentalRouter)





const PORT = process.env.PORT || 8002;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

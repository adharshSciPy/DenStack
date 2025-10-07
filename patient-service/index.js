import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDb.js";
import patientRegisterRouter from "./routes/patientRegisterRoutes.js";
import patientAppointmentRouter from "./routes/patientAppointmentRoute.js";


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

app.use("/api/v1/patient-service/patient",patientRegisterRouter)
app.use("/api/v1/patient-service/appointment",patientAppointmentRouter)



const PORT = process.env.PORT || 8002;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

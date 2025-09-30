import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import doctorOnboard from "./routes/doctorOnboardRouter.js";


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
app.use("/api/v1/clinic-service",doctorOnboard)



const PORT = process.env.PORT || 8003;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/config.js";

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



const PORT = process.env.PORT || 8004;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

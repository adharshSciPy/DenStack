import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/config.js";

// Load env vars
dotenv.config();

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});


// Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

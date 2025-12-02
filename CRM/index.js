import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./connectdb/connectdb.js";
import notificationRoutes from "./router/notificatonRoute.js";
import { initializeSocket } from "./utils/socket.js";
import "./utils/scheduler.js";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app); // ✅ Create HTTP server for Socket.IO

// Initialize Socket.IO
initializeSocket(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/notifications", notificationRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Notification service is running",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8011;

server.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Notification Service Started");
  console.log("=".repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔔 API endpoint: http://localhost:${PORT}/api/notifications`);
  console.log(`🔌 Socket.IO: Active`);
  console.log(`⏰ Cron jobs: Active`);
  console.log("=".repeat(50) + "\n");
});

// Error handling
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});
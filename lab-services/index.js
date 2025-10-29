import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import labRouter from "./routes/labRoutes.js";
import labOrderRouter from "./routes/labOrderRoutes.js";
import path from "path";
dotenv.config();
connectDB();

const app = express();
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename)

// Middleware
app.use(cors());
app.use(express.json());
// app.use("/uploads", express.static(path.join(__dirname, "/uploads")));


// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});
app.use("/api/v1/lab",labRouter)
app.use("/api/v1/lab-orders",labOrderRouter)

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


const PORT = process.env.PORT || 8005;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

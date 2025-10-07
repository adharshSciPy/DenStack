import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import blogRoute from "./routes/blogRoutes.js";
import path from "path";
import { fileURLToPath } from "url";



dotenv.config();
connectDB();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));


// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});
app.use("/api/v1/blog",blogRoute)



const PORT = process.env.PORT || 8005;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

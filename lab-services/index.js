import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import labRouter from "./routes/labRoutes.js";
import labOrderRouter from "./routes/labOrderRoutes.js";
import labInventoryRouter from "./routes/LabInventoryRouter.js";
import alignerRouter from "./routes/alignerRouter.js";
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
app.use("/api/v1/lab-inventory",labInventoryRouter)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/v1/aligners", alignerRouter);

const PORT = process.env.PORT || 8006;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

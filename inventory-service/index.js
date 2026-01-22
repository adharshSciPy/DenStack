import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./mongoDB/config.js";
import categoryRoute from "./Routes/categoryRouter.js";
import productRoute from "./Routes/productRouter.js";
import orderRouter from "./Routes/orderRouter.js";
import vendorRouter from "./Routes/vendorRouter.js";
import brandRouter from "./Routes/brandRouter.js";
import notificationRouter from "./Routes/notificationRouter.js";
import landingRouter from "./Routes/landingPageRouter.js";
import ecomOrderRouter from "./Routes/E-OrderRouter.js";
import cartRouter from "./Routes/cartRouter.js";

import lowStockAlertsCron from "./middlewares/lowStockCron.js";

dotenv.config();
connectDB();

const app = express();

// ✅ CORS Configuration - MUST come before routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname setup (since you're using ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Serve uploaded images statically with CORS headers
app.use("/uploads", (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(process.cwd(), "uploads")));

// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

// Low Stock alerts
lowStockAlertsCron();

app.use("/api/v1/category", categoryRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/vendor", vendorRouter);
app.use("/api/v1/brand", brandRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/landing", landingRouter);
app.use("/api/v1/ecom-order", ecomOrderRouter);
app.use("/api/v1/cart", cartRouter);

const PORT = process.env.PORT || 8004;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});
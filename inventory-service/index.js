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

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname setup (since you're using ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Serve uploaded images statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

app.use("/api/v1/category", categoryRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/vendor", vendorRouter)



const PORT = process.env.PORT || 8004;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

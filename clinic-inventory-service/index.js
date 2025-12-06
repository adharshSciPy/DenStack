import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js"; 
import clinicPurchaseRoute from "./routes/clinicPurchaseRoute.js"
import clinicInventoryRoute from "./routes/clinicInventoryRoute.js";
import clinicProductRoute from "./routes/clinicProductRoute.js";
import assignRouter from "./routes/assignRouter.js";
dotenv.config();
console.log("url", process.env.MONGO_URL)
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});


app.use("/api/v1/clinicPurchase",clinicPurchaseRoute)
app.use("/api/v1/clinicInventory", clinicInventoryRoute);
app.use("/api/v1/clinicProduct", clinicProductRoute);
app.use("/api/v1/assign",assignRouter)

const PORT = process.env.PORT || 8010;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});

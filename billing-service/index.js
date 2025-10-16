import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import billingRouter from "../billing-service/routes/billingRouter.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/billing", billingRouter);

const PORT = process.env.PORT || 8000;

app.listen(PORT||8008, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

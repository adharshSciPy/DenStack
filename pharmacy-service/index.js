import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import pharmacyRouter from "./routes/pharmacyVendorRoutes.js";
import medicineRouter from "./routes/medicineRoutes.js";


dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(express.json());



app.use("/api/v1/lab",pharmacyRouter)
app.use("/api/v1/medicine",medicineRouter)




const PORT = process.env.PORT || 8005;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});
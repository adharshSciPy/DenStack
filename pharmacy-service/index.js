import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./mongoDB/connectDB.js";
import pharmacyRouter from "./routes/pharmacyVendorRoutes.js";
import medicineRouter from "./routes/medicineRoutes.js";
import pharmacyOrderRouter from "./routes/pharmacyOrderRoutes.js";
import pharmacyInventoryRouter from "./routes/pharmacyInventoryRouter.js";



dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(express.json());



app.use("/api/v1/pharmacy-details",pharmacyRouter)
app.use("/api/v1/medicine",medicineRouter)
app.use("/api/v1/pharmacy-orders", pharmacyOrderRouter)
app.use("/api/v1/pharmacy/inventory", pharmacyInventoryRouter);




const PORT = process.env.PORT || 8007;
app.listen(PORT, () => {
  console.log(`✅ Server running on port:${PORT}`);
});
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./connectdb/connectdb.js"

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());


const PORT = process.env.PORT || 8011;

app.listen(PORT||8011, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

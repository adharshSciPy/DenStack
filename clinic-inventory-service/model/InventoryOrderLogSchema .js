// models/InventoryOrderLog.js
import mongoose from "mongoose";

const InventoryOrderLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      unique: true,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryOrderLog", InventoryOrderLogSchema);
// models/StockTransfer.js
import mongoose from "mongoose";

const stockTransferSchema = new mongoose.Schema(
  {
    clinicId: { type: String, required: true },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: String,

    fromInventoryType: {
      type: String,
      enum: ["general", "pharmacy", "lab"],
      default: "general",
    },

    toInventoryType: {
      type: String,
      enum: ["pharmacy", "lab"],
      required: true,
    },

    quantity: { type: Number, required: true },

    source: {
      type: String,
      enum: ["ECOM_ORDER", "MANUAL"],
      default: "MANUAL",
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedTo: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("StockTransfer", stockTransferSchema);

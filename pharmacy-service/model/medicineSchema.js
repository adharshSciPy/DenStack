import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PharmacyVendor",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
  batchNumber: String,
  expiryDate: Date,
  pricePerUnit: {
    type: Number,
    required: true,
  },
  stockQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  category: String, // e.g. Tablet, Syrup, Injection
  status: {
    type: String,
    enum: ["available", "out-of-stock"],
    default: "available",
  },
}, { timestamps: true });

export default mongoose.model("Medicine", medicineSchema);

import mongoose from "mongoose";

const pharmacyOrderSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PharmacyVendor",
  },
  prescriptionItems: [
    {
      medicineName: String,
      dosage: String,
      quantity: Number,
      duration: String,
      price: Number,
    }
  ],
  orderDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "in-progress", "delivered", "cancelled"],
    default: "pending",
  },
  notes: String,
  deliveredAt: Date,
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
  },
}, { timestamps: true });

export default mongoose.model("PharmacyOrder", pharmacyOrderSchema);

import mongoose from "mongoose";

const alignerOrderSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LabVendor",
    required: true
  },
  caseId: {
    type: String,
    required: true,
    unique: true
  },

  doctorName: String,
  clinicName: String,

  trays: {
    upperArch: Number,
    lowerArch: Number
  },

  treatmentDuration: String, // "7 months 2 weeks"

  status: {
    type: String,
    enum: ["draft", "approved", "manufacturing", "shipped", "in-treatment", "completed"],
    default: "draft"
  },

  notes: String,

  totalAmount: Number,
  paymentStatus: {
    type: String,
    enum: ["pending", "paid"],
    default: "pending"
  }

}, { timestamps: true });

export default mongoose.model("AlignerOrder", alignerOrderSchema);

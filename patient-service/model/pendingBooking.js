// models/PendingBooking.js
import mongoose from "mongoose";

const pendingBookingSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true
  },
  
  // Patient submitted details
  patientDetails: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }, // Store as string for validation
    age: { type: Number, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    message: { type: String }
  },
  
  // Appointment requested details
  requestedAppointment: {
    department: { type: String, required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    doctorName: { type: String },
    preferredDate: { type: String, required: true },
    preferredTime: { type: String, required: true },
    reason: { type: String }
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "expired"],
    default: "pending"
  },
  
  // Processing details
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  processedAt: { type: Date },
  
  // Result after processing
  result: {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    opNumber: { type: Number },
    wasExistingPatient: { type: Boolean, default: false }
  },
  
  rejectionReason: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(+new Date() + 7*24*60*60*1000) } 
});

pendingBookingSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
pendingBookingSchema.index({ "patientDetails.phone": 1 });
pendingBookingSchema.index({ "patientDetails.email": 1 });

export default mongoose.model("PendingBooking", pendingBookingSchema);
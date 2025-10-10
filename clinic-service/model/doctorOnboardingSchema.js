// models/doctorClinicSchema.js
import mongoose, { Schema } from "mongoose";

const doctorClinicSchema = new Schema({
  doctorId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Doctor",
    index: true
  },
  clinicId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Clinic",
    index: true
  },
  roleInClinic: {
    type: String,
    enum: ["consultant", "visiting", "permanent"],
    default: "consultant"
  },
  status: {
    type: String,
    enum: ["pending", "active", "removed"],
    default: "active"
  },
  standardConsultationFee: { type: Number, default: 0 ,required:true},
  clinicLogin: {
    email: { type: String, lowercase: true, trim: true },
    password: { type: String }, // hashed separately
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "Clinic" // clinic admin who onboarded doctor
  }
}, { timestamps: true });

// prevent duplicate mapping
doctorClinicSchema.index({ doctorId: 1, clinicId: 1 }, { unique: true });

export default mongoose.model("DoctorClinic", doctorClinicSchema);

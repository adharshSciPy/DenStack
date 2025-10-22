import mongoose from "mongoose";
const appointmentSchema = new mongoose.Schema({
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Patient",
    required: true 
  },
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Clinic",
    required: true 
  },
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Doctor",
    required: false 
  },
  department: {
    type: String,
    required: true
  },
    appointmentDate: { type: String, required: true }, // e.g. "2025-10-09"
    appointmentTime: { type: String, required: true }, 
  status: { 
    type: String, 
    enum: ["scheduled", "cancelled", "completed"],
    default: "scheduled"
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    
  },
    visitId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "PatientHistory" 
  },
    opNumber: { type: Number, required: true } 
}, { timestamps: true });

appointmentSchema.index(
  { clinicId: 1, doctorId: 1, appointmentDate: 1, appointmentTime: 1, status: 1, opNumber: 1 },
  { unique: true, partialFilterExpression: { doctorId: { $exists: true } } }
);


export default mongoose.model("Appointment", appointmentSchema);

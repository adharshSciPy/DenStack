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
  appointmentDate: { type: Date, required: true },
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
    
  }
}, { timestamps: true });

appointmentSchema.index({ patientId: 1, appointmentDate: -1 });

export default mongoose.model("Appointment", appointmentSchema);

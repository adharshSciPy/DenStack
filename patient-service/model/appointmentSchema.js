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
    enum: ["scheduled", "cancelled", "completed","needs_reschedule","recall","pending_approval"],
    default: "scheduled"
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId,
    // required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
  visitId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "PatientHistory" 
  },

  // Your requested fields
  opNumber: { type: Number },
  rescheduledFromOp: { type: Number, default: null },
  approvedBy: {
  type: mongoose.Schema.Types.ObjectId,
},
approvedAt: {
  type: Date,
}


}, { timestamps: true });

appointmentSchema.index(
  { clinicId: 1, doctorId: 1, appointmentDate: 1, appointmentTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "scheduled" }
  }
);

appointmentSchema.index({ patientId: 1, clinicId: 1, appointmentDate: -1 });

export default mongoose.model("Appointment", appointmentSchema);

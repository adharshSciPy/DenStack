import mongoose from "mongoose";
const patientHistorySchema = new mongoose.Schema({
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
    ref: "Doctor" 
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: false // visit may or may not be tied to an appointment
  },
  visitDate: { type: Date, default: Date.now },
  symptoms: { type: [String], default: [] },
  diagnosis: { type: [String], default: [] },
  prescriptions: { type: [String], default: [] },
  notes: { type: String, maxlength: [1000, "Notes cannot exceed 1000 characters"] },
  files: [
    {
      url: { 
        type: String,
        match: [/^https?:\/\/.+\..+/, "Please enter a valid URL"] 
      },
      type: { type: String, enum: ["image", "pdf", "report", "other"], default: "other" },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

patientHistorySchema.index({ patientId: 1, visitDate: -1 });

export default mongoose.model("PatientHistory", patientHistorySchema);

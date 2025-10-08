import mongoose from "mongoose";

const patientHistorySchema = new mongoose.Schema(
  {
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
      required: true 
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true
    },
    visitDate: { type: Date, default: Date.now },

    // ✅ Doctor-entered data
    symptoms: { type: [String], default: [] },
    diagnosis: { type: [String], default: [] },
    prescriptions: [
      {
        medicineName: { type: String, required: true },
        dosage: { type: String },
        frequency: { type: String },
        duration: { type: String },
      },
    ],
    notes: { type: String, maxlength: [1000, "Notes cannot exceed 1000 characters"] },
    

    // ✅ Files uploaded (lab reports, images, etc.)
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

    // ✅ Referrals
    referrals: [
      {
        type: { type: String, enum: ["lab", "pharmacy", "specialist"], required: true },
        referenceId: { type: mongoose.Schema.Types.ObjectId }, // e.g., LabRequest, Prescription, or referred Doctor
        notes: String,
        createdAt: { type: Date, default: Date.now },
      }
    ],

    status: { type: String, enum: ["pending", "completed"], default: "completed" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  },
  { timestamps: true }
);

patientHistorySchema.index({ patientId: 1, visitDate: -1 });

export default mongoose.model("PatientHistory", patientHistorySchema);

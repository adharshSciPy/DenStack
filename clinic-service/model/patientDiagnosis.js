// models/PatientDiagnosis.js
import mongoose, { Schema } from "mongoose";

const patientDiagnosisSchema = new Schema({
  clinicId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Clinic",
    index: true
  },
  name: {
    type: String,
    required: [true, "Diagnosis name is required"],
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

patientDiagnosisSchema.index({ clinicId: 1, name: 1 }, { unique: true });

export default mongoose.model("PatientDiagnosis", patientDiagnosisSchema);
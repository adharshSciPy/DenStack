import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const PATIENT_ROLE = process.env.PATIENT_ROLE;

const patientSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true
  },
  name: {
    type: String,
    required: [true, "Name is required"],
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [100, "Name cannot exceed 100 characters"]
  },
  phone: {
    type: Number,
    required: [true, "Phone number is required"],
    match: [/^\d{10}$/, "Phone number must be 10 digits"]
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
  },
  password: {
    type: String,
    minlength: [8, "Password must be at least 8 characters"],
    maxlength: [64, "Password cannot exceed 64 characters"],
    select: false
  },
  age: { type: Number, min: 0, max: 150 },
  gender: { type: String, enum: ["Male", "Female", "Other"], default: "Other" },

  medicalHistory: {
    conditions: [String],
    surgeries: [String],
    allergies: [String],
    familyHistory: [String]
  },

  patientUniqueId: { type: String, unique: true },
   patientRandomId: { type: String, unique: true }, 
  parentPatient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  linkedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }],
  role: { type: String, default: PATIENT_ROLE },
  // patientHistory:[{type:mongoose.Schema.Types.ObjectId,ref:"PatientHistory"}],
  createdBy: { type: String },
  visitHistory: [
    { type: mongoose.Schema.Types.ObjectId, ref: "PatientHistory" }
  ],

  otpToken: { type: String, select: false },
  otpTokenExpiry: { type: Date, select: false },
  treatmentPlans: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TreatmentPlan"
    }
  ],


  createdAt: { type: Date, default: Date.now }
});

// Generate OP number before saving
patientSchema.pre("save", async function (next) {
  try {
    // Prevent duplicate generation
    if (!this.patientUniqueId || !this.patientRandomId) {
      // === Sequential ID generation ===
      const url = `${AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${this.clinicId}`;
      let prefix = "DEN-CLC";

      try {
        const clinicRes = await axios.get(url);
        if (clinicRes?.data?.data?.name) {
          const rawName = clinicRes.data.data.name.replace(/[^a-zA-Z]/g, "");
          prefix = rawName.substring(0, 3).toUpperCase() || "DEN";
        }
      } catch (err) {
        console.error("Clinic fetch failed, using fallback prefix:", err.message);
      }

      const count = await mongoose.model("Patient").countDocuments({ clinicId: this.clinicId });
      const formattedNumber = String(count + 1).padStart(6, "0");

      // Generate sequential ID if missing
      if (!this.patientUniqueId)
        this.patientUniqueId = `${prefix}-${formattedNumber}`;

      // === Random ID generation ===
      if (!this.patientRandomId) {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const randomLetter = letters.charAt(Math.floor(Math.random() * letters.length));
        const randomDigits = Math.floor(100000 + Math.random() * 900000); // 6 random digits
        this.patientRandomId = `P${randomLetter}-${randomDigits}`;
      }
    }
  } catch (err) {
    console.error("Error generating patient IDs:", err.message);
    const fallbackRandom = Math.floor(100000 + Math.random() * 900000);
    if (!this.patientUniqueId) this.patientUniqueId = `DEN-CLC-${fallbackRandom}`;
    if (!this.patientRandomId) this.patientRandomId = `PX-${fallbackRandom}`;
  }

  next();
});


// ✅ Useful indexes
patientSchema.index({ clinicId: 1, createdAt: -1 });
patientSchema.index({ clinicId: 1, name: 1 });
patientSchema.index({ clinicId: 1, patientUniqueId: 1 }, { unique: true });
patientSchema.index({ clinicId: 1, phone: 1 }, { unique: true });



export default mongoose.model("Patient", patientSchema);

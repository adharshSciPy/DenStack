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
    lowercase: true,
  trim: true,
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
  labHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
      }
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
    const Patient = mongoose.model("Patient");

    const normalizedName = this.name.trim().toLowerCase();
    const normalizedEmail = this.email?.trim().toLowerCase();
    const phone = this.phone;

    let existingPatient = null;

    // -------- Matching Logic --------
    if (normalizedEmail) {
      existingPatient = await Patient.findOne({
        email: normalizedEmail,
        name: new RegExp(`^${this.name}$`, "i"),
        phone
      }).lean();
    } else {
      existingPatient = await Patient.findOne({
        name: new RegExp(`^${this.name}$`, "i"),
        phone
      }).lean();
    }

    // Same (Name + Email) OR (Name + Phone) → SAME Random ID
    if (existingPatient?.patientRandomId) {
      this.patientRandomId = existingPatient.patientRandomId;
    }

    // If NO matching global patient → Generate new ID
    if (!this.patientRandomId) {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      this.patientRandomId = `P${randomLetter}-${randomDigits}`;
    }

    // -------- Generate Clinic-Based Unique ID --------
    if (!this.patientUniqueId) {
      let prefix = "DEN";

      try {
        const response = await axios.get(
          `${process.env.AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${this.clinicId}`
        );
        if (response?.data?.data?.name) {
          prefix = response.data.data.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "DEN";
        }
      } catch {
        prefix = "DEN";
      }

      const count = await Patient.countDocuments({ clinicId: this.clinicId });
      this.patientUniqueId = `${prefix}-${String(count + 1).padStart(5, "0")}`;
    }

  } catch (err) {
    console.error("❌ Patient pre-save hook error:", err.message);
  }

  next();
});




// ✅ Useful indexes
patientSchema.index({ clinicId: 1, phone: 1 }, { unique: false });
patientSchema.index({ clinicId: 1, email: 1 }, { unique: false });

patientSchema.index({ clinicId: 1, patientUniqueId: 1 }, { unique: true });



export default mongoose.model("Patient", patientSchema);
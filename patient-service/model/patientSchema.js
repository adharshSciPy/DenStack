import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const PATIENT_ROLE=process.env.PATIENT_ROLE;

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

  patientUniqueId: { type: String, unique: true}, 
 parentPatient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  linkedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }],
  role:{type:String,default:PATIENT_ROLE},
  // patientHistory:[{type:mongoose.Schema.Types.ObjectId,ref:"PatientHistory"}],
  createdBy: { type: String },
  visitHistory: [
  { type: mongoose.Schema.Types.ObjectId, ref: "PatientHistory" }
],

  createdAt: { type: Date, default: Date.now }
});

// Generate OP number before saving
patientSchema.pre("save", async function(next) {
  if (this.patientUniqueId) return next();

  try {
    const url = `${AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${this.clinicId}`;
    // console.log("Fetching clinic from:", url);

    const clinicRes = await axios.get(url);
    // console.log("Clinic fetch response:", clinicRes.data);

    let prefix = "DEN-CLC"; 
    if (clinicRes?.data?.data?.name) {
      const rawName = clinicRes.data.data.name.replace(/[^a-zA-Z]/g, "");
      prefix = rawName.substring(0, 3).toUpperCase() || "DEN";
    }

    const count = await mongoose.model("Patient").countDocuments({ clinicId: this.clinicId });
    this.patientUniqueId = `${prefix}-${String(count + 1).padStart(6, "0")}`;
    // console.log("Generated OP Number:", this.patientUniqueId);

  } catch (err) {
    console.error("Clinic fetch failed, using fallback OP:", err.message);
    const random = Math.floor(100000 + Math.random() * 900000);
    this.patientUniqueId = `DEN-CLC-${random}`;
  }

  next();
});


// Good indexes for large-scale reads:
patientSchema.index({ clinicId: 1, createdAt: -1 });   
patientSchema.index({ clinicId: 1, name: 1 });     
patientSchema.index({ clinicId: 1, patientUniqueId: 1 }, { unique: true }); 
patientSchema.index({ clinicId: 1, phone: 1 }, { unique: true }); 



export default mongoose.model("Patient", patientSchema);

import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
// import { TOOTH_CONDITIONS } from "../middleware/toothSurfaceAndConditions";
import { Schema } from "mongoose";
import {  TOOTH_SURFACES} from "../middleware/toothSurfaceAndConditions.js";
import ClinicCounter from "./clinicCounterSchema.js";


dotenv.config();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const PATIENT_ROLE = process.env.PATIENT_ROLE;

const dentalChartEntrySchema = new mongoose.Schema({
  toothNumber: { 
    type: Number, 
    required: true 
  },
  
  // Keep conditions for general tooth conditions
  conditions: [{ 
    type: String  
  }],
  
  // Unified procedures array - all dental work goes here
  procedures: [{
    type: {
      type: String,
      enum: ["condition", "treatment"],
      default: "treatment"
    },
    name: { type: String, required: true },
    surface: { 
      type: String, 
      enum: [...TOOTH_SURFACES, "entire"],  // Add 'entire' for full tooth procedures
      required: true 
    },
    status: {
      type: String,
      enum: ["planned", "in-progress", "completed"],
      default: "completed"
    },
    
    // For conditions
    conditionType: {
      type: String,

    },
    
    // For treatments
    procedureType: {
      type: String,
      // enum: ["filling", "extraction", "root-canal", "crown", "denture", "cleaning", "other"]
    },
    
    // Cost information
    cost: Number,
    estimatedCost: Number,
    
    // Metadata
    notes: String,
    date: { type: Date, default: Date.now },
    performedBy: { type: Schema.Types.ObjectId, ref: "Doctor" },
    
    // References
    treatmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: "TreatmentPlan"
    },
    visitIds: [{  
      type: Schema.Types.ObjectId,
      ref: "PatientHistory"
    }],
    
    // For tracking
    _id: false  
  }],
  
  lastVisitId: {
    type: Schema.Types.ObjectId,
    ref: "PatientHistory"
  },
  
  // Timestamps
  lastUpdated: { type: Date, default: Date.now },
  lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "Doctor" }
}, { timestamps: true });

// Remove surfaceConditions array since everything goes to procedures


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
  dateOfBirth: {
    type: Date
  },

  bloodGroup: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
  },

  height: {
    type: Number,
    min: 30,
    max: 300
  },

  weight: {
    type: Number, 
    min: 1,
    max: 500
  },

  address: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String }
  },
    emergencyContact: {
    name: { type: String },
    relation: { type: String },
    phone: {
      type: Number,
      match: [/^\d{10}$/, "Emergency contact must be 10 digits"]
    }
  },
  medicalHistory: {
    conditions: [String],
    surgeries: [String],
    allergies: [String],
    familyHistory: [String]
  },
 dentalChart: {
    type: [dentalChartEntrySchema],
    default: []
  },
  patientUniqueId: { type: String  },
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

    reviewToken: { type: String },
    isReviewed: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});
patientSchema.methods.isSurfaceTreated = function(toothNumber, surface) {
  const tooth = this.dentalChart.find(t => t.toothNumber === toothNumber);
  if (!tooth) return false;
  
  // Check if surface or 'entire' tooth has been treated
  return tooth.treatedSurfaces.some(ts => 
    ts.surface === surface || 
    ts.surface === 'entire' || 
    (surface === 'entire' && ts.surface !== 'entire')
  );
};

// ✅ Method to add procedure to dental chart with conflict detection
patientSchema.methods.addDentalProcedure = function(toothNumber, procedureData) {
  const { procedureName, surface, performedBy, visitId, treatmentPlanId, notes, status = 'completed' } = procedureData;
  
  // Validate surface for conflict
  if (this.isSurfaceTreated(toothNumber, surface)) {
    throw new Error(`Surface '${surface}' of tooth ${toothNumber} has already been treated. Please review dental chart before proceeding.`);
  }
  
  // Find or create tooth entry
  let tooth = this.dentalChart.find(t => t.toothNumber === toothNumber);
  
  if (!tooth) {
    tooth = {
      toothNumber,
      toothType: 'permanent',
      currentStatus: 'healthy',
      procedures: [],
      treatedSurfaces: [],
      lastModifiedAt: new Date(),
      lastModifiedBy: performedBy
    };
    this.dentalChart.push(tooth);
  }
  
  // Add procedure
  const newProcedure = {
    procedureName,
    surface,
    performedBy,
    performedAt: new Date(),
    visitId,
    treatmentPlanId,
    notes,
    status
  };
  
  tooth.procedures.push(newProcedure);
  
  // Update treated surfaces
  const existingSurface = tooth.treatedSurfaces.find(ts => ts.surface === surface);
  if (existingSurface) {
    existingSurface.lastTreatedAt = new Date();
    existingSurface.lastProcedure = procedureName;
  } else {
    tooth.treatedSurfaces.push({
      surface,
      lastTreatedAt: new Date(),
      lastProcedure: procedureName
    });
  }
  
  tooth.lastModifiedAt = new Date();
  tooth.lastModifiedBy = performedBy;
  
  return newProcedure;
};

// ✅ Method to get complete dental history for a tooth
patientSchema.methods.getToothHistory = function(toothNumber) {
  const tooth = this.dentalChart.find(t => t.toothNumber === toothNumber);
  if (!tooth) {
    return {
      toothNumber,
      hasHistory: false,
      message: 'No procedures recorded for this tooth'
    };
  }
  
  return {
    toothNumber,
    hasHistory: true,
    currentStatus: tooth.currentStatus,
    totalProcedures: tooth.procedures.length,
    treatedSurfaces: tooth.treatedSurfaces,
    procedures: tooth.procedures.sort((a, b) => b.performedAt - a.performedAt),
    generalNotes: tooth.generalNotes
  };
};

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
// const counter = await ClinicCounter.findOneAndUpdate(
//   { clinicId: this.clinicId },
//   { $inc: { seq: 1 } },
//   { new: true, upsert: true }
// );

// const nextNumber = counter.seq;

// this.patientUniqueId = `${prefix}-${String(nextNumber).padStart(5, "0")}`;

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
patientSchema.index({ patientRandomId: 1 }, { unique: true, sparse: true });


export default mongoose.model("Patient", patientSchema);
import mongoose from "mongoose";

const visitSchema = new mongoose.Schema({
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Clinic", 
    required: [true, "Clinic ID is required"] 
  },
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Doctor", 
    required: false // doctor might not be assigned at registration
  },
  visitDate: { 
    type: Date, 
    default: Date.now 
  },
  symptoms: {
    type: [String],
    default: [] // receptionist may not enter symptoms initially
  },
  diagnosis: {
    type: [String],
    default: [] // doctor fills later
  },
  prescriptions: {
    type: [String],
    default: [] // doctor fills later
  },
  notes: {
    type: String,
    maxlength: [1000, "Notes cannot exceed 1000 characters"]
  },
  files: [
    {
      url: { 
        type: String,
        match: [/^https?:\/\/.+\..+/, "Please enter a valid URL"] 
      },
      type: {
        type: String,
        enum: ["image", "pdf", "report", "other"],
        default: "other"
      },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending"
  },
  createdBy: { // receptionist or system
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: { // usually doctor who finalizes it
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

const patientSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Name is required"],
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [100, "Name cannot exceed 100 characters"]
  },
  phone: { 
    type: String, 
    required: [true, "Phone number is required"], 
    unique: true,
    match: [/^\d{10}$/, "Phone number must be 10 digits"]
  },
  email: { 
    type: String, 
    unique: true,
    sparse: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
  },
  age: { 
    type: Number,
    min: [0, "Age cannot be negative"],
    max: [150, "Age seems unrealistic"]
  },
  gender: { 
    type: String, 
    enum: ["Male", "Female", "Other"], 
    default: "Other" 
  },
  medicalHistory: {
    type: [String],
    default: []
  },
  visits: [visitSchema],
  createdAt: { type: Date, default: Date.now }
});

// Indexes
patientSchema.index({ phone: 1, email: 1 });
patientSchema.index({ "_id": 1, "visits.visitDate": -1 });

export default mongoose.model("Patient", patientSchema);

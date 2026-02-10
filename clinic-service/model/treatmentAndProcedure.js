// models/TreatmentProcedure.js
import mongoose, { Schema } from "mongoose";

const treatmentProcedureSchema = new Schema({
  clinicId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Clinic",
    index: true
  },
  name: {
    type: String,
    required: [true, "Procedure name is required"],
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price cannot be negative"]
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

// Compound index for clinic + name uniqueness
treatmentProcedureSchema.index({ clinicId: 1, name: 1 }, { unique: true });

export default mongoose.model("TreatmentProcedure", treatmentProcedureSchema);
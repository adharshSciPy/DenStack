// models/ExaminationFinding.js
import mongoose, { Schema } from "mongoose";

const examinationFindingSchema = new Schema({
  clinicId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Clinic",
    index: true
  },
  name: {
    type: String,
    required: [true, "Examination finding name is required"],
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

examinationFindingSchema.index({ clinicId: 1, name: 1 }, { unique: true });

export default mongoose.model("ExaminationFinding", examinationFindingSchema);
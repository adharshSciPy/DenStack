// models/DentalHistory.js
import mongoose, { Schema } from "mongoose";

const dentalHistorySchema = new Schema({
  clinicId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Clinic",
    index: true
  },
  name: {
    type: String,
    required: [true, "Dental history name is required"],
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  price:{
    type: Number,
    default: 0
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

dentalHistorySchema.index({ clinicId: 1, name: 1 }, { unique: true });

export default mongoose.model("DentalHistory", dentalHistorySchema);
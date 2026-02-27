import mongoose from "mongoose";

const clinicCounterSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

export default mongoose.model("ClinicCounter", clinicCounterSchema);

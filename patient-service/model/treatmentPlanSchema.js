import mongoose, { Schema } from "mongoose";

const procedureSchema = new Schema({
  name: { type: String, required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true }, // responsible doctor
  referredToDoctorId: { type: Schema.Types.ObjectId, ref: "Doctor" },
  referralNotes: { type: String },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  notes: { type: String },
});

const stageSchema = new Schema({
  stageName: { type: String, required: true },
  description: { type: String },
  procedures: [procedureSchema],
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  scheduledDate: { type: Date },
});
const dentalChartSchema = new Schema({
    toothNumber: { type: Number, required: true, min: 1, max: 32 },
    status: {
      type: String,
      enum: ['healthy', 'filled', 'crowned', 'root-canal', 'missing', 'decayed'],
      default: 'healthy'
    },
  notes: String,
  procedures: [
    {
      name: String,
      performedBy: { type: Schema.Types.ObjectId, ref: "Doctor" },
      performedAt: Date,
    }
  ]
});

const treatmentPlanSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    clinicId: { type: Schema.Types.ObjectId, required: true },
    createdByDoctorId: { type: Schema.Types.ObjectId, required: true },
    planName: { type: String, required: true },
    description: { type: String },
    stages: [stageSchema],
    status: { type: String, enum: ["ongoing", "completed"], default: "ongoing" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    dentalChart: { type: [dentalChartSchema], required: false }

  },
  { timestamps: true }
);

export default mongoose.model("TreatmentPlan", treatmentPlanSchema);

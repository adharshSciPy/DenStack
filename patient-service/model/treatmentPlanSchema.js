import mongoose, { Schema } from "mongoose";

const treatmentPlanSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    planName: { type: String, required: true },
    description: { type: String },

    stages: [
      {
        stageName: { type: String, required: true },
        description: { type: String },
        procedures: [
          {
            name: { type: String, required: true },
            completed: { type: Boolean, default: false },
            completedAt: { type: Date },
          },
        ],
        status: { type: String, enum: ["pending", "completed"], default: "pending" },
        scheduledDate: { type: Date },
      },
    ],

    status: { type: String, enum: ["ongoing", "completed"], default: "ongoing" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("TreatmentPlan", treatmentPlanSchema);

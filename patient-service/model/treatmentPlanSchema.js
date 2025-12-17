import mongoose, { Schema } from "mongoose";

const procedureSchema = new Schema({
  name: { type: String, required: true },
  toothNumber: { type: Number, min: 1, max: 32 },
  surface: {
    type: String,
    enum: ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'palatal', 'incisal', 'full-crown', 'root', 'entire']
  },
  doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
  referredToDoctorId: { type: Schema.Types.ObjectId, ref: "Doctor" },
  referralNotes: { type: String },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedInVisitId: { type: Schema.Types.ObjectId, ref: "PatientHistory" },
  notes: { type: String },
});

const stageSchema = new Schema({
  stageName: { type: String, required: true },
  description: { type: String },
  procedures: [procedureSchema],
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  scheduledDate: { type: Date },
});
const dentalChartPlanSchema = new Schema({
  toothNumber: { type: Number, required: true, min: 1, max: 32 },
  plannedStatus: {
    type: String,
    enum: ['fill', 'crown', 'root-canal', 'extract', 'implant', 'bridge', 'clean'],
    required: true
  },
  surface: {
    type: String,
    enum: ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'palatal', 'incisal', 'full-crown', 'root', 'entire']
  },
  notes: String,
  estimatedCost: { type: Number, default: 0 },
  priority: { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedInVisitId: { type: Schema.Types.ObjectId, ref: "PatientHistory" }
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
   dentalChart: [dentalChartPlanSchema],
 conflictChecked: { type: Boolean, default: false }
  },
  { timestamps: true }
);
treatmentPlanSchema.methods.markProcedureCompleted = function(procedureId, visitId) {
  for (const stage of this.stages) {
    const procedure = stage.procedures.id(procedureId);
    if (procedure) {
      procedure.completed = true;
      procedure.completedAt = new Date();
      procedure.completedInVisitId = visitId;
      
      // Check if all procedures in stage are completed
      const allCompleted = stage.procedures.every(p => p.completed);
      if (allCompleted) {
        stage.status = 'completed';
      }
      
      return procedure;
    }
  }
  return null;
};

// ✅ Method to check for conflicts with patient's existing dental work
treatmentPlanSchema.methods.checkConflicts = async function() {
  const Patient = mongoose.model("Patient");
  const patient = await Patient.findById(this.patientId);
  
  if (!patient) {
    throw new Error("Patient not found");
  }
  
  const conflicts = [];
  
  for (const plannedWork of this.dentalChart) {
    const tooth = patient.dentalChart.find(t => t.toothNumber === plannedWork.toothNumber);
    
    if (tooth && plannedWork.surface) {
      const isTreated = tooth.treatedSurfaces.some(ts => 
        ts.surface === plannedWork.surface || 
        ts.surface === 'entire' ||
        plannedWork.surface === 'entire'
      );
      
      if (isTreated) {
        conflicts.push({
          toothNumber: plannedWork.toothNumber,
          surface: plannedWork.surface,
          message: `Tooth ${plannedWork.toothNumber} surface '${plannedWork.surface}' has already been treated`
        });
      }
    }
  }
  
  this.conflictChecked = true;
  return conflicts;
};

// Calculate total estimated cost
treatmentPlanSchema.pre("save", function(next) {
  this.totalEstimatedCost = this.dentalChart.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
  next();
});
treatmentPlanSchema.index({ patientId: 1, clinicId: 1 });
export default mongoose.model("TreatmentPlan", treatmentPlanSchema);

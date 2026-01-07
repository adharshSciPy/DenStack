import mongoose, { Schema } from "mongoose";
import { TOOTH_CONDITIONS,TOOTH_SURFACES } from "../middleware/toothSurfaceAndConditions.js";
const plannedProcedureSchema = new Schema({
  name: { type: String, required: true }, 

  surface: { type: String, enum: TOOTH_SURFACES, required: true },

  status: {
    type: String,
    enum:['planned', 'in-progress', 'completed'],
    default: 'planned'
  },

  estimatedCost: { type: Number, default: 0 },
  notes: String,

  // execution tracking
  completedAt: Date,
  completedInVisitId: {
    type: Schema.Types.ObjectId,
    ref: "PatientHistory"
  },

  referredToDoctorId: { type: Schema.Types.ObjectId, ref: "Doctor" }
});

const toothPlanSchema = new Schema({
  toothNumber: { type: Number, min: 1, max: 32, required: true },

  procedures: [plannedProcedureSchema],

  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low'],
    default: 'medium'
  },

  isCompleted: { type: Boolean, default: false },
  completedAt: Date
});
const treatmentStageSchema = new Schema({
  stageName: { type: String, required: true },
  description: String,
  procedureRefs: [
    {
      toothNumber: Number,
      procedureName: String
    }
  ],

  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },

  scheduledDate: Date,
  completedAt: Date
});



const treatmentPlanSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    clinicId: { type: Schema.Types.ObjectId, required: true },
    createdByDoctorId: { type: Schema.Types.ObjectId, required: true },
    planName: { type: String, required: true },
    description: { type: String },
     stages: [treatmentStageSchema],
    status: { type: String, enum: ["ongoing", "completed"], default: "ongoing" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
     teeth: [toothPlanSchema],
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

treatmentPlanSchema.pre("save", function (next) {
  this.totalEstimatedCost = this.teeth.reduce((sum, tooth) => {
    return sum + tooth.procedures.reduce(
      (pSum, p) => pSum + (p.estimatedCost || 0),
      0
    );
  }, 0);
  next();
});

treatmentPlanSchema.index({ patientId: 1, clinicId: 1 });
export default mongoose.model("TreatmentPlan", treatmentPlanSchema);

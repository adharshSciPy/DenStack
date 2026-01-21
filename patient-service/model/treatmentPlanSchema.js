import mongoose, { Schema } from "mongoose";
import { TOOTH_CONDITIONS, TOOTH_SURFACES } from "../middleware/toothSurfaceAndConditions.js";

const plannedProcedureSchema = new Schema({
  name: { type: String, required: true },
  surface: { type: String, enum: TOOTH_SURFACES, required: true },
  status: {
    type: String,
    enum: ['planned', 'in-progress', 'completed'],
    default: 'planned'
  },
  estimatedCost: { type: Number, default: 0 },
  notes: String,
  
  stage: { type: Number, required: true, default: 1 },
  
  completedAt: Date,
  completedInVisitId: {
    type: Schema.Types.ObjectId,
    ref: "PatientHistory"
  },
  performedBy: { type: Schema.Types.ObjectId, ref: "Doctor" }
});

const toothPlanSchema = new Schema({
  toothNumber: { type: Number, required: true },
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
  stageNumber: { type: Number, required: true },
  stageName: { type: String, required: true },
  description: String,
  
  // ✅ FIXED: Track surface-procedure pairs properly
  toothSurfaceProcedures: [{
    toothNumber: { type: Number, required: true },
    surfaceProcedures: [{
      surface: { type: String, enum: TOOTH_SURFACES, required: true },
      procedureNames: [{ type: String }] // Multiple procedures on same surface
    }]
  }],
  
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  
  scheduledDate: Date,
  startedAt: Date,
  completedAt: Date,
  notes: String,
  
  completedInVisitId: {
    type: Schema.Types.ObjectId,
    ref: "PatientHistory"
  }
});

const treatmentPlanSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    clinicId: { type: Schema.Types.ObjectId, required: true },
    createdByDoctorId: { type: Schema.Types.ObjectId, required: true },
    planName: { type: String, required: true },
    description: { type: String },
    
    teeth: [toothPlanSchema],
    stages: [treatmentStageSchema],
    
    currentStage: { type: Number, default: 1 },
    status: { 
      type: String, 
      enum: ["draft", "ongoing", "completed", "cancelled"], 
      default: "draft" 
    },
    
    startedAt: { type: Date },
    completedAt: { type: Date },
    conflictChecked: { type: Boolean, default: false },
       cancellationReason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "Doctor" },
    totalEstimatedCost: { type: Number, default: 0 },
    completedCost: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// ========== HELPER METHODS ==========
// Method to update overall plan status

treatmentPlanSchema.methods.updatePlanStatus = function() {
  // Calculate based on stages first (priority)
  if (this.stages && this.stages.length > 0) {
    const allStagesCompleted = this.stages.every(s => s.status === 'completed');
    const anyStageInProgress = this.stages.some(s => s.status === 'in-progress');
    const anyStageCompleted = this.stages.some(s => s.status === 'completed');
    
    if (allStagesCompleted) {
      this.status = "completed";
      this.completedAt = this.completedAt || new Date();
      this.startedAt = this.startedAt || new Date();
    } else if (anyStageInProgress || anyStageCompleted) {
      this.status = "ongoing";
      this.startedAt = this.startedAt || new Date();
    } else {
      this.status = "draft";
    }
    
    // Update current stage
    const incompleteStage = this.stages.find(s => s.status !== 'completed');
    if (incompleteStage) {
      this.currentStage = incompleteStage.stageNumber;
    } else if (this.stages.length > 0) {
      this.currentStage = this.stages[this.stages.length - 1].stageNumber;
    }
    
    return;
  }
  
  // Fallback to old logic if no stages
  const totalProcedures = this.teeth.reduce((sum, tooth) => sum + tooth.procedures.length, 0);
  const completedProcedures = this.teeth.reduce((sum, tooth) => 
    sum + tooth.procedures.filter(p => p.status === 'completed').length, 0
  );
  
  if (totalProcedures === 0) {
    this.status = "draft";
  } else if (completedProcedures === 0) {
    this.status = "draft";
  } else if (completedProcedures === totalProcedures) {
    this.status = "completed";
    this.completedAt = new Date();
  } else if (completedProcedures > 0 && completedProcedures < totalProcedures) {
    this.status = "ongoing";
    this.startedAt = this.startedAt || new Date();
  } else {
    this.status = "draft";
  }
};

// Method to mark stage as completed

treatmentPlanSchema.methods.completeStage = function(stageNumber, visitId, doctorId) {
  const stage = this.stages.find(s => s.stageNumber === stageNumber);
  
  if (!stage) {
    throw new Error(`Stage ${stageNumber} not found`);
  }
  
  // Find all procedures in this stage and mark them as completed
  this.teeth.forEach(tooth => {
    tooth.procedures.forEach(procedure => {
      if (procedure.stage === stageNumber && procedure.status !== 'completed') {
        procedure.status = 'completed';
        procedure.completedAt = new Date();
        procedure.completedInVisitId = visitId;
        procedure.performedBy = doctorId;
      }
    });
    
    // Update tooth completion status
    const allProceduresCompleted = tooth.procedures.every(p => p.status === 'completed');
    tooth.isCompleted = allProceduresCompleted;
    if (allProceduresCompleted) {
      tooth.completedAt = new Date();
    }
  });
  
  // Update stage status
  stage.status = 'completed';
  stage.completedAt = new Date();
  stage.completedInVisitId = visitId;
  
  // Call the new method
  this.updatePlanStatus();
  
  return stage;
};

// Method to get all procedures for a stage
treatmentPlanSchema.methods.getProceduresForStage = function(stageNumber) {
  const procedures = [];
  
  this.teeth.forEach(tooth => {
    const stageProcedures = tooth.procedures.filter(p => p.stage === stageNumber);
    stageProcedures.forEach(proc => {
      procedures.push({
        ...proc.toObject(),
        toothNumber: tooth.toothNumber,
        priority: tooth.priority
      });
    });
  });
  
  return procedures;
};

// Method to add procedures to a stage
treatmentPlanSchema.methods.addProceduresToStage = function(stageNumber, proceduresData) {
  // Find or create stage
  let stage = this.stages.find(s => s.stageNumber === stageNumber);
  if (!stage) {
    stage = {
      stageNumber: stageNumber,
      stageName: `Stage ${stageNumber}`,
      toothSurfaceProcedures: [],
      status: 'pending'
    };
    this.stages.push(stage);
    this.stages.sort((a, b) => a.stageNumber - b.stageNumber);
  }
  
  // Group procedures by tooth and surface
  const proceduresByToothAndSurface = {};
  
  proceduresData.forEach(procData => {
    const toothKey = procData.toothNumber;
    const surfaceKey = procData.surface || 'occlusal';
    
    if (!proceduresByToothAndSurface[toothKey]) {
      proceduresByToothAndSurface[toothKey] = {};
    }
    
    if (!proceduresByToothAndSurface[toothKey][surfaceKey]) {
      proceduresByToothAndSurface[toothKey][surfaceKey] = new Set();
    }
    
    proceduresByToothAndSurface[toothKey][surfaceKey].add(procData.name);
    
    // Find or create tooth
    let tooth = this.teeth.find(t => t.toothNumber === procData.toothNumber);
    if (!tooth) {
      tooth = {
        toothNumber: procData.toothNumber,
        procedures: [],
        priority: procData.priority || 'medium',
        isCompleted: false
      };
      this.teeth.push(tooth);
    }
    
    // Check if procedure already exists
    const existingProc = tooth.procedures.find(p => 
      p.name === procData.name && 
      p.surface === surfaceKey &&
      p.stage === stageNumber
    );
    
    if (!existingProc) {
      tooth.procedures.push({
        name: procData.name,
        surface: surfaceKey,
        stage: stageNumber,
        estimatedCost: procData.estimatedCost || 0,
        notes: procData.notes || '',
        status: 'planned'
      });
    }
  });
  
  // Build stage's toothSurfaceProcedures
  stage.toothSurfaceProcedures = Object.entries(proceduresByToothAndSurface).map(([toothNumStr, surfaces]) => {
    const toothNumber = parseInt(toothNumStr);
    const surfaceProcedures = Object.entries(surfaces).map(([surface, procedureNamesSet]) => ({
      surface: surface,
      procedureNames: Array.from(procedureNamesSet)
    }));
    
    return {
      toothNumber: toothNumber,
      surfaceProcedures: surfaceProcedures
    };
  });
  
  return stage;
};

// Method to get stage overview with proper surface-procedure mapping
treatmentPlanSchema.methods.getStageOverview = function(stageNumber) {
  const stage = this.stages.find(s => s.stageNumber === stageNumber);
  if (!stage) {
    throw new Error(`Stage ${stageNumber} not found`);
  }
  
  const procedures = this.getProceduresForStage(stageNumber);
  const teethInStage = [...new Set(procedures.map(p => p.toothNumber))];
  
  // Build detailed surface-procedure mapping
  const proceduresByToothAndSurface = {};
  
  procedures.forEach(proc => {
    const toothKey = proc.toothNumber;
    const surfaceKey = proc.surface;
    
    if (!proceduresByToothAndSurface[toothKey]) {
      proceduresByToothAndSurface[toothKey] = {};
    }
    
    if (!proceduresByToothAndSurface[toothKey][surfaceKey]) {
      proceduresByToothAndSurface[toothKey][surfaceKey] = [];
    }
    
    proceduresByToothAndSurface[toothKey][surfaceKey].push({
      name: proc.name,
      status: proc.status,
      estimatedCost: proc.estimatedCost,
      notes: proc.notes,
      completedAt: proc.completedAt
    });
  });
  
  return {
    stageNumber: stage.stageNumber,
    stageName: stage.stageName,
    status: stage.status,
    scheduledDate: stage.scheduledDate,
    completedAt: stage.completedAt,
    
    totalProcedures: procedures.length,
    completedProcedures: procedures.filter(p => p.status === 'completed').length,
    teethCount: teethInStage.length,
    teeth: teethInStage,
    
    estimatedCost: procedures.reduce((sum, p) => sum + (p.estimatedCost || 0), 0),
    actualCost: procedures
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.estimatedCost || 0), 0),
    
    // Detailed breakdown by tooth and surface
    proceduresByTooth: teethInStage.map(toothNum => {
      const tooth = this.teeth.find(t => t.toothNumber === toothNum);
      const surfaceData = proceduresByToothAndSurface[toothNum] || {};
      
      const surfaces = Object.entries(surfaceData).map(([surface, procedures]) => ({
        surface: surface,
        procedures: procedures,
        totalProcedures: procedures.length,
        completedProcedures: procedures.filter(p => p.status === 'completed').length
      }));
      
      return {
        toothNumber: toothNum,
        priority: tooth?.priority || 'medium',
        isCompleted: tooth?.isCompleted || false,
        surfaces: surfaces,
        summary: {
          totalProcedures: surfaces.reduce((sum, s) => sum + s.totalProcedures, 0),
          completedProcedures: surfaces.reduce((sum, s) => sum + s.completedProcedures, 0),
          totalSurfaces: surfaces.length
        }
      };
    })
  };
};

// Pre-save hook for costs
treatmentPlanSchema.pre("save", function (next) {
  // Calculate total estimated cost
  this.totalEstimatedCost = this.teeth.reduce((sum, tooth) => {
    return sum + tooth.procedures.reduce(
      (pSum, p) => pSum + (p.estimatedCost || 0),
      0
    );
  }, 0);
  
  // Calculate completed cost
  this.completedCost = this.teeth.reduce((sum, tooth) => {
    return sum + tooth.procedures
      .filter(p => p.status === 'completed')
      .reduce((pSum, p) => pSum + (p.estimatedCost || 0), 0);
  }, 0);
  
  next();
});

treatmentPlanSchema.index({ patientId: 1, clinicId: 1 });
export default mongoose.model("TreatmentPlan", treatmentPlanSchema);
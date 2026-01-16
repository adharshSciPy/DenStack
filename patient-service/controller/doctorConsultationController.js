import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import Patient from "../model/patientSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import TreatmentPlan from "../model/treatmentPlanSchema.js";
dotenv.config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

const consultPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: appointmentId } = req.params;
    const doctorId = req.doctorId;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    if (!doctorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ---------- helpers ----------
    const parseJSON = (v, d = []) =>
      v == null ? d : typeof v === "string" ? JSON.parse(v) : v;

    const symptoms = parseJSON(req.body.symptoms, []);
    const diagnosis = parseJSON(req.body.diagnosis, []);
    const prescriptionsRaw = parseJSON(req.body.prescriptions, []);
    const files = parseJSON(req.body.files, []);
    const plannedProcedures = parseJSON(req.body.plannedProcedures, []);
    const performedTeeth = parseJSON(req.body.performedTeeth, []);
    const treatmentPlanInput = parseJSON(req.body.treatmentPlan, null);
    const treatmentPlanStatusUpdate = parseJSON(req.body.treatmentPlanStatus, null);
    const recall = parseJSON(req.body.recall, null);
    const notes = req.body.notes || "";

    console.log("📥 ========== CONSULTATION REQUEST RECEIVED ==========");
    console.log("📋 Treatment Plan Input:", treatmentPlanInput ? {
      planName: treatmentPlanInput.planName,
      teethCount: treatmentPlanInput.teeth?.length || 0,
      stagesCount: treatmentPlanInput.stages?.length || 0,
      startToday: treatmentPlanInput.startToday
    } : "No treatment plan");
    
    // Log detailed stage information from frontend
    if (treatmentPlanInput?.stages) {
      console.log("📊 STAGES RECEIVED FROM FRONTEND:");
      treatmentPlanInput.stages.forEach((stage, index) => {
        console.log(`  Stage ${index + 1}:`);
        console.log(`    Name: ${stage.stageName}`);
        console.log(`    Status from frontend: ${stage.status || 'pending'}`);
        console.log(`    Scheduled Date: ${stage.scheduledDate}`);
        console.log(`    Procedure Refs: ${stage.procedureRefs?.length || 0}`);
      });
    }

    // ---------- normalize prescriptions ----------
    const prescriptions = prescriptionsRaw.map(p => ({
      medicineName: p.medicineName || p.medicine,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration
    }));

    // ---------- fetch appointment ----------
    const appointment = await Appointment.findById(appointmentId).session(session);
    if (!appointment || appointment.status === "cancelled") {
      return res.status(404).json({ success: false, message: "Invalid appointment" });
    }

    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res.status(403).json({ success: false, message: "Doctor mismatch" });
    }

    const patient = await Patient.findById(appointment.patientId).session(session);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // ---------- files ----------
    const uploadedFiles = (req.files || []).map(f => ({
      url: `/uploads/${f.filename}`,
      type: f.mimetype.includes("image")
        ? "image"
        : f.mimetype.includes("pdf")
        ? "pdf"
        : "other",
      uploadedAt: new Date()
    }));

    const allFiles = [...files, ...uploadedFiles];
    
    // ---------- CREATE VISIT ----------
    const dentalWork = performedTeeth.map(t => ({
      toothNumber: t.toothNumber,
      conditions: t.conditions || [],
      surfaceConditions: (t.surfaceConditions || []).map(sc => ({
        surface: sc.surface,
        conditions: sc.conditions || []
      })),
      procedures: (t.procedures || []).map(p => ({
        name: p.name,
        surface: p.surface,
        status: p.status || "completed",
        cost: p.cost,
        notes: p.notes,
        performedBy: doctorId,
        performedAt: new Date(),
      }))
    }));

    console.log("🦷 Performed Teeth Data:", {
      count: performedTeeth.length,
      proceduresCount: performedTeeth.reduce((sum, t) => sum + (t.procedures?.length || 0), 0)
    });

    const [visitDoc] = await PatientHistory.create(
      [{
        patientId: appointment.patientId,
        clinicId: appointment.clinicId,
        doctorId,
        appointmentId,
        symptoms,
        diagnosis,
        prescriptions,
        notes,
        files: allFiles,
        dentalWork,
        createdBy: doctorId
      }],
      { session }
    );

    console.log("✅ Visit created:", visitDoc._id);

    let treatmentPlan = null;
    let updatedExistingPlan = false;

    // ---------- CHECK FOR EXISTING TREATMENT PLAN TO UPDATE ----------
    if (treatmentPlanStatusUpdate?.planId) {
      console.log("🔄 Updating existing treatment plan status");
      
      treatmentPlan = await TreatmentPlan.findById(treatmentPlanStatusUpdate.planId).session(session);
      if (!treatmentPlan) {
        throw new Error("Treatment plan not found");
      }

      console.log("📋 Existing plan found:", {
        planName: treatmentPlan.planName,
        currentStatus: treatmentPlan.status,
        stagesCount: treatmentPlan.stages.length
      });

      // Update stage completion if specified
      if (treatmentPlanStatusUpdate.completedStageNumber) {
        const stageNumber = treatmentPlanStatusUpdate.completedStageNumber;
        const stage = treatmentPlan.stages.find(s => s.stageNumber == stageNumber);
        
        console.log(`🎯 Completing Stage ${stageNumber}:`, stage ? stage.stageName : "Not found");
        
        if (stage && stage.status !== "completed") {
          // Complete all procedures in this stage
          treatmentPlan.teeth.forEach(tooth => {
            tooth.procedures.forEach(procedure => {
              if (procedure.stage == stageNumber && procedure.status !== "completed") {
                procedure.status = "completed";
                procedure.completedAt = new Date();
                procedure.completedInVisitId = visitDoc._id;
                procedure.performedBy = doctorId;
                console.log(`✅ Marked procedure ${procedure.name} as completed`);
              }
            });
            
            // Check if all procedures for this tooth are completed
            const toothProcedures = tooth.procedures.filter(p => p.status === "completed");
            if (toothProcedures.length === tooth.procedures.length) {
              tooth.isCompleted = true;
              tooth.completedAt = new Date();
              console.log(`✅ Tooth ${tooth.toothNumber} completed`);
            }
          });

          // Update stage status
          stage.status = "completed";
          stage.completedAt = new Date();
          stage.completedInVisitId = visitDoc._id;
          console.log(`✅ Stage ${stageNumber} marked as completed`);
        }
      }

      // Update specific procedures if provided
      if (treatmentPlanStatusUpdate.completedProcedures?.length > 0) {
        console.log("🔧 Updating specific procedures:", treatmentPlanStatusUpdate.completedProcedures);
        
        treatmentPlanStatusUpdate.completedProcedures.forEach(procUpdate => {
          const tooth = treatmentPlan.teeth.find(t => t.toothNumber == procUpdate.toothNumber);
          if (tooth) {
            const procedure = tooth.procedures.find(p => 
              p.name === procUpdate.procedureName && 
              p.surface === procUpdate.surface &&
              p.stage == procUpdate.stageNumber
            );
            
            if (procedure && procedure.status !== "completed") {
              procedure.status = "completed";
              procedure.completedAt = new Date();
              procedure.completedInVisitId = visitDoc._id;
              procedure.performedBy = doctorId;
              console.log(`✅ Marked procedure ${procedure.name} on tooth ${tooth.toothNumber} as completed`);
            }
          }
        });
      }

      // Update overall plan status
      treatmentPlan.updatePlanStatus();
      
      // Update stage statuses based on completed procedures
      console.log("📊 Updating stage statuses:");
      treatmentPlan.stages.forEach(stage => {
        const proceduresInStage = treatmentPlan.teeth.flatMap(tooth =>
          tooth.procedures.filter(p => p.stage == stage.stageNumber)
        );
        
        const completedCount = proceduresInStage.filter(p => p.status === "completed").length;
        const totalCount = proceduresInStage.length;
        
        console.log(`  Stage ${stage.stageNumber} (${stage.stageName}):`);
        console.log(`    Procedures: ${completedCount}/${totalCount} completed`);
        console.log(`    Previous status: ${stage.status}`);
        
        if (totalCount === 0) {
          stage.status = "pending";
        } else if (completedCount === totalCount) {
          stage.status = "completed";
          stage.completedAt = stage.completedAt || new Date();
        } else if (completedCount > 0) {
          stage.status = "in-progress";
          stage.startedAt = stage.startedAt || new Date();
        }
        
        console.log(`    New status: ${stage.status}`);
      });

      updatedExistingPlan = true;
      await treatmentPlan.save({ session });
      console.log("✅ Existing treatment plan updated");
    }

    // ---------- CREATE NEW TREATMENT PLAN ----------
    if (!updatedExistingPlan && treatmentPlanInput?.planName) {
      console.log("🆕 Creating new treatment plan");
      
      // Process teeth data
      const teethData = (treatmentPlanInput.teeth || []).map(toothPlan => ({
        toothNumber: toothPlan.toothNumber,
        priority: toothPlan.priority || 'medium',
        isCompleted: false,
        procedures: toothPlan.procedures.map(proc => ({
          name: proc.name,
          surface: proc.surface || 'occlusal',
          stage: proc.stage || 1,
          estimatedCost: proc.estimatedCost || 0,
          notes: proc.notes || '',
          status: proc.status || 'planned' // Use status from frontend
        }))
      }));
      
      // Log procedures with statuses
      console.log("🦷 Teeth Data with Procedure Statuses:");
      teethData.forEach(tooth => {
        console.log(`  Tooth ${tooth.toothNumber}:`);
        tooth.procedures.forEach(proc => {
          console.log(`    - ${proc.name} (Stage ${proc.stage}): ${proc.status}`);
        });
      });
      
      // Process stages data with toothSurfaceProcedures
    const stagesData = (treatmentPlanInput.stages || []).map((stageInput, index) => {
  const stageNumber = index + 1;
  
  console.log(`📋 Processing Stage ${stageNumber} from frontend:`);
  console.log(`  Name: ${stageInput.stageName}`);
  console.log(`  Status from frontend: ${stageInput.status || 'pending'}`);
  console.log(`  Scheduled Date: ${stageInput.scheduledDate}`);
  
  // Build toothSurfaceProcedures for this stage
  const toothSurfaceProcedures = [];
  
  // Group procedures by tooth and surface for this stage
  const proceduresByToothAndSurface = {};
  
  teethData.forEach(tooth => {
    // Get procedures for this stage
    const stageProcedures = tooth.procedures.filter(p => p.stage === stageNumber);
    
    if (stageProcedures.length > 0) {
      const toothKey = tooth.toothNumber;
      proceduresByToothAndSurface[toothKey] = {};
      
      // Group by surface
      stageProcedures.forEach(proc => {
        const surfaceKey = proc.surface;
        if (!proceduresByToothAndSurface[toothKey][surfaceKey]) {
          proceduresByToothAndSurface[toothKey][surfaceKey] = new Set();
        }
        proceduresByToothAndSurface[toothKey][surfaceKey].add(proc.name);
      });
    }
  });
  
  // Convert to toothSurfaceProcedures format
  Object.entries(proceduresByToothAndSurface).forEach(([toothNumStr, surfaces]) => {
    const toothNumber = parseInt(toothNumStr);
    const surfaceProcedures = Object.entries(surfaces).map(([surface, procedureNamesSet]) => ({
      surface: surface,
      procedureNames: Array.from(procedureNamesSet)
    }));
    
    toothSurfaceProcedures.push({
      toothNumber: toothNumber,
      surfaceProcedures: surfaceProcedures
    });
  });
  
  // CRITICAL FIX: Determine stage status correctly
  const stageStatus = stageInput.status || 'pending';
  
  console.log(`  Using status: ${stageStatus} (from frontend)`);
  console.log(`  Tooth-Surface Procedures: ${toothSurfaceProcedures.length} entries`);
  
  return {
    stageNumber: stageNumber,
    stageName: stageInput.stageName || `Stage ${stageNumber}`,
    description: stageInput.description || '',
    status: stageStatus,
    scheduledDate: stageInput.scheduledDate ? new Date(stageInput.scheduledDate) : null,
    toothSurfaceProcedures: toothSurfaceProcedures,
    notes: stageInput.notes || '',
    // Set timestamps based on status
    ...(stageStatus === 'in-progress' && { startedAt: new Date() }),
    ...(stageStatus === 'completed' && { completedAt: new Date() })
  };
});

// FIX: Calculate overall plan status based on stages
const hasInProgressStages = stagesData.some(stage => stage.status === 'in-progress');
const hasCompletedStages = stagesData.some(stage => stage.status === 'completed');
const allStagesCompleted = stagesData.length > 0 && stagesData.every(stage => stage.status === 'completed');
const allStagesPending = stagesData.length > 0 && stagesData.every(stage => stage.status === 'pending');

let planStatus = "draft";

if (allStagesCompleted) {
  planStatus = "completed";
} else if (hasInProgressStages || hasCompletedStages) {
  planStatus = "ongoing";
} else if (allStagesPending) {
  planStatus = "draft";
}

console.log(`📊 Calculated plan status: ${planStatus}`);
console.log(`  Has in-progress stages: ${hasInProgressStages}`);
console.log(`  Has completed stages: ${hasCompletedStages}`);
console.log(`  All stages completed: ${allStagesCompleted}`);
console.log(`  All stages pending: ${allStagesPending}`);

// Create treatment plan
[treatmentPlan] = await TreatmentPlan.create(
  [{
    patientId: appointment.patientId,
    clinicId: appointment.clinicId,
    createdByDoctorId: doctorId,
    planName: treatmentPlanInput.planName.trim(),
    description: treatmentPlanInput.description?.trim() || '',
    teeth: teethData,
    stages: stagesData,
    status: planStatus, // Use calculated status
    currentStage: 1,
    startedAt: planStatus === "ongoing" || planStatus === "completed" ? new Date() : null,
    completedAt: planStatus === "completed" ? new Date() : null
  }],
  { session }
);

console.log("✅ Treatment plan created:", {
  planName: treatmentPlan.planName,
  teethCount: treatmentPlan.teeth.length,
  stagesCount: treatmentPlan.stages.length,
  status: treatmentPlan.status,
  totalProcedures: treatmentPlan.teeth.reduce((sum, t) => sum + t.procedures.length, 0)
});
      
      // Log final stage statuses
      console.log("📊 FINAL STAGE STATUSES SAVED TO DATABASE:");
      treatmentPlan.stages.forEach((stage, index) => {
        console.log(`  Stage ${index + 1}: ${stage.stageName} - Status: ${stage.status}`);
      });

      // Link to patient
      if (!patient.treatmentPlans) {
        patient.treatmentPlans = [];
      }
      patient.treatmentPlans.push(treatmentPlan._id);
      await patient.save({ session });
    }

    // ---------- UPDATE NEWLY CREATED TREATMENT PLAN WITH PERFORMED PROCEDURES ----------
    if (treatmentPlan && !updatedExistingPlan && performedTeeth.length > 0) {
      console.log("🔄 Updating newly created treatment plan with performed procedures");
      
      performedTeeth.forEach(toothWork => {
        const toothNumber = toothWork.toothNumber;
        
        const toothPlan = treatmentPlan.teeth.find(t => t.toothNumber === toothNumber);
        if (!toothPlan) return;
        
        toothPlan.procedures.forEach(procedure => {
          if (procedure.stage === 1 && procedure.status !== 'completed') {
            const matchingPerformedProc = toothWork.procedures?.find(p => 
              p.name === procedure.name && 
              p.surface === procedure.surface
            );
            
            if (matchingPerformedProc) {
              procedure.status = 'completed';
              procedure.completedAt = new Date();
              procedure.completedInVisitId = visitDoc._id;
              procedure.performedBy = doctorId;
              console.log(`✅ Procedure ${procedure.name} on tooth ${toothNumber} marked as completed (post-creation)`);
            }
          }
        });
        
        // Update tooth completion status
        const allProceduresCompleted = toothPlan.procedures.every(p => p.status === 'completed');
        toothPlan.isCompleted = allProceduresCompleted;
        if (allProceduresCompleted) {
          toothPlan.completedAt = new Date();
        }
      });
      
      // Update stage status
      const stage = treatmentPlan.stages.find(s => s.stageNumber === 1);
      if (stage) {
        const proceduresInStage = treatmentPlan.teeth.flatMap(t => 
          t.procedures.filter(p => p.stage === 1)
        );
        const completedProcedures = proceduresInStage.filter(p => p.status === 'completed').length;
        const totalProcedures = proceduresInStage.length;
        
        console.log(`📊 Stage 1 after performed procedures: ${completedProcedures}/${totalProcedures} completed`);
        
        if (totalProcedures === 0) {
          stage.status = 'pending';
        } else if (completedProcedures === 0) {
          stage.status = 'pending';
        } else if (completedProcedures === totalProcedures) {
          stage.status = 'completed';
          stage.completedAt = new Date();
          stage.completedInVisitId = visitDoc._id;
          console.log(`✅ Stage 1 marked as completed (post-creation)`);
        } else {
          stage.status = 'in-progress';
          stage.startedAt = stage.startedAt || new Date();
          console.log(`✅ Stage 1 marked as in-progress (post-creation)`);
        }
      }
      
      // Update overall plan status if any procedures were completed
      if (treatmentPlan.status === "draft" && performedTeeth.length > 0) {
        treatmentPlan.status = "ongoing";
        treatmentPlan.startedAt = new Date();
        console.log(`📈 Plan status updated from draft to ongoing`);
      }
      
      treatmentPlan.updatePlanStatus();
      
      await treatmentPlan.save({ session });
      console.log("✅ New treatment plan updated after performed procedures");
    }

    // ---------- link visit to treatment plan ----------
    if (treatmentPlan) {
      visitDoc.treatmentPlanId = treatmentPlan._id;
      await visitDoc.save({ session });
      console.log("🔗 Visit linked to treatment plan");
    }

    // ---------- recall ----------
    if (recall?.appointmentDate && recall?.appointmentTime) {
      await Appointment.create([{
        patientId: appointment.patientId,
        clinicId: appointment.clinicId,
        doctorId: appointment.doctorId,
        appointmentDate: recall.appointmentDate,
        appointmentTime: recall.appointmentTime,
        status: "recall",
        createdBy: doctorId,
        department: appointment.department,
        rescheduledFromOp: appointment.opNumber,
        visitId: visitDoc._id
      }], { session });
      console.log("📅 Recall appointment created");
    }

    // ---------- finalize ----------
    await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: "completed", visitId: visitDoc._id },
      { session }
    );

    if (!patient.visitHistory) {
      patient.visitHistory = [];
    }
    patient.visitHistory.push(visitDoc._id);
    await patient.save({ session });

    await session.commitTransaction();

    console.log("🎉 ========== CONSULTATION COMPLETED SUCCESSFULLY ==========");
    console.log("📋 Final Treatment Plan State:");
    if (treatmentPlan) {
      console.log(`  Plan: ${treatmentPlan.planName}`);
      console.log(`  Status: ${treatmentPlan.status}`);
      console.log(`  Stages:`);
      treatmentPlan.stages.forEach((stage, index) => {
        console.log(`    Stage ${index + 1}: ${stage.stageName} - ${stage.status}`);
      });
    }

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      visit: visitDoc,
      treatmentPlan: treatmentPlan || null,
      planUpdated: updatedExistingPlan
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("❌ consultPatient error:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      success: false,
      message: "Consultation failed",
      error: err.message,
    });
  } finally {
    session.endSession();
    console.log("🔚 Session ended");
  }
};
const startTreatmentPlan = async (req, res) => {
  try {
    const { id: patientId } = req.params; // patient id from URL
    const { clinicId, planName, description, stages } = req.body;
         const doctorId = req.doctorId; 


    if (!clinicId || !planName) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic ID and Plan Name are required" });
    }

    // 1️⃣ Create the treatment plan
    const newPlan = await TreatmentPlan.create({
      patientId,
      clinicId,
      createdByDoctorId: doctorId,
      planName,
      description,
      stages,
    });

    // 2️⃣ Update patient record
    await Patient.findByIdAndUpdate(
      patientId,
      { $push: { treatmentPlans: newPlan._id } },
      { new: true }
    );

    // 3️⃣ Find the latest consultation / patient history for this patient
    const latestHistory = await PatientHistory.findOne({ patientId })
      .sort({ createdAt: -1 })
      .limit(1);

    // 4️⃣ Link treatment plan to latest patient history (if exists)
    if (latestHistory) {
      latestHistory.treatmentPlanId = newPlan._id;
      await latestHistory.save();
    }

    res.status(201).json({
      success: true,
      message: "Treatment plan created successfully",
      data: newPlan,
    });
  } catch (error) {
    console.error("Error starting treatment plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error while creating treatment plan",
    });
  }
};
const addStageToTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;
    const { stageName, description, scheduledDate, toothSurfaceProcedures = [] } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(treatmentPlanId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid treatment plan ID"
      });
    }

    if (!stageName) {
      return res.status(400).json({
        success: false,
        message: "Stage name is required"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a completed treatment plan"
      });
    }

    // Calculate next stage number
    const nextStageNumber = treatmentPlan.stages.length > 0 
      ? Math.max(...treatmentPlan.stages.map(s => s.stageNumber)) + 1
      : 1;

    // Create new stage
    const newStage = {
      stageNumber: nextStageNumber,
      stageName,
      description: description || "",
      toothSurfaceProcedures: toothSurfaceProcedures.map(tsp => ({
        toothNumber: tsp.toothNumber,
        surfaceProcedures: (tsp.surfaceProcedures || []).map(sp => ({
          surface: sp.surface,
          procedureNames: sp.procedureNames || []
        }))
      })),
      status: "pending",
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      notes: ""
    };

    // Add stage to treatment plan
    treatmentPlan.stages.push(newStage);
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Stage added successfully",
      stage: newStage,
      treatmentPlan
    });

  } catch (error) {
    console.error("addStageToTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding stage",
      error: error.message
    });
  }
};
const updateProcedureStatus = async (req, res) => {
  try {
    const { id: planId, stageIndex, procedureIndex } = req.params;
    const { completed } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a completed treatment plan"
      });
    }

    // Get the stage
    const stage = treatmentPlan.stages[stageIndex];
    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found"
      });
    }

    // First, mark plan as ongoing if it's draft
    if (treatmentPlan.status === "draft") {
      treatmentPlan.status = "ongoing";
      treatmentPlan.startedAt = treatmentPlan.startedAt || new Date();
    }

    // Update stage status to in-progress
    if (stage.status === "pending") {
      stage.status = "in-progress";
      stage.startedAt = stage.startedAt || new Date();
    }

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Procedure status updated successfully",
      stage,
      treatmentPlan
    });

  } catch (error) {
    console.error("updateProcedureStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating procedure status",
      error: error.message
    });
  }
};
const completeStage = async (req, res) => {
  try {
    const { id: planId, stageIndex } = req.params;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid treatment plan ID",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    const index = Number(stageIndex);

    if (
      Number.isNaN(index) ||
      index < 0 ||
      index >= treatmentPlan.stages.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid stage index",
      });
    }

    const stage = treatmentPlan.stages[index];

    if (stage.status === "completed") {
      return res.status(400).json({
        success: false,
        message: `Stage "${stage.stageName}" is already completed`,
      });
    }

    // 🔑 Resolve stageNumber from index
    const stageNumber = stage.stageNumber;

    // Use existing schema method (SAFE)
    const completedStage = treatmentPlan.completeStage(
      stageNumber,
      null, // visitId (optional)
      doctorId
    );

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: `Stage "${stage.stageName}" completed successfully`,
      stageIndex: index,
      stageNumber,
      stage: completedStage,
      treatmentPlan,
    });

  } catch (error) {
    console.error("completeStage error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while completing stage",
      error: error.message,
    });
  }
};

const finishTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Treatment plan already completed"
      });
    }

    const now = new Date();

    // Complete all procedures in all teeth
    treatmentPlan.teeth.forEach(tooth => {
      tooth.procedures.forEach(procedure => {
        if (procedure.status !== "completed") {
          procedure.status = "completed";
          procedure.completedAt = now;
          procedure.performedBy = doctorId;
        }
      });
      
      // Mark tooth as completed
      tooth.isCompleted = true;
      tooth.completedAt = now;
    });

    // Complete all stages
    treatmentPlan.stages.forEach(stage => {
      if (stage.status !== "completed") {
        stage.status = "completed";
        stage.completedAt = now;
      }
    });

    // Complete the entire plan
    treatmentPlan.status = "completed";
    treatmentPlan.completedAt = now;
    treatmentPlan.currentStage = treatmentPlan.stages.length;

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Treatment plan completed successfully",
      treatmentPlan
    });

  } catch (error) {
    console.error("finishTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while completing treatment plan",
      error: error.message
    });
  }
};
const removeProcedure = async (req, res) => {
  try {
    const { id: planId, toothNumber } = req.params;
    const { procedureName, surface } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!procedureName || !surface) {
      return res.status(400).json({
        success: false,
        message: "Procedure name and surface are required"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a completed treatment plan"
      });
    }

    // Find the tooth
    const tooth = treatmentPlan.teeth.find(t => t.toothNumber == toothNumber);
    if (!tooth) {
      return res.status(404).json({
        success: false,
        message: `Tooth ${toothNumber} not found in treatment plan`
      });
    }

    // Find and remove the procedure
    const procedureIndex = tooth.procedures.findIndex(
      p => p.name === procedureName && p.surface === surface
    );

    if (procedureIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Procedure "${procedureName}" on surface "${surface}" not found for tooth ${toothNumber}`
      });
    }

    const removedProcedure = tooth.procedures[procedureIndex];
    const stageNumber = removedProcedure.stage;

    // Remove the procedure
    tooth.procedures.splice(procedureIndex, 1);

    // Remove the procedure reference from the stage's toothSurfaceProcedures
    const stage = treatmentPlan.stages.find(s => s.stageNumber == stageNumber);
    if (stage) {
      const toothSurface = stage.toothSurfaceProcedures.find(
        tsp => tsp.toothNumber == toothNumber
      );
      
      if (toothSurface) {
        // Find the surface
        const surfaceProc = toothSurface.surfaceProcedures.find(
          sp => sp.surface === surface
        );
        
        if (surfaceProc) {
          // Remove the procedure name from the array
          surfaceProc.procedureNames = surfaceProc.procedureNames.filter(
            name => name !== procedureName
          );
          
          // If no more procedures on this surface, remove the surface entry
          if (surfaceProc.procedureNames.length === 0) {
            toothSurface.surfaceProcedures = toothSurface.surfaceProcedures.filter(
              sp => sp.surface !== surface
            );
          }
          
          // If no more surfaces for this tooth, remove the tooth entry
          if (toothSurface.surfaceProcedures.length === 0) {
            stage.toothSurfaceProcedures = stage.toothSurfaceProcedures.filter(
              tsp => tsp.toothNumber != toothNumber
            );
          }
        }
      }
    }

    // If tooth has no more procedures, remove the tooth
    if (tooth.procedures.length === 0) {
      treatmentPlan.teeth = treatmentPlan.teeth.filter(
        t => t.toothNumber != toothNumber
      );
    }

    // Update plan costs
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: `Procedure "${procedureName}" removed from tooth ${toothNumber}`,
      treatmentPlan
    });

  } catch (error) {
    console.error("removeProcedure error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing procedure",
      error: error.message
    });
  }
};
const removeStage = async (req, res) => {
  try {
    const { id: planId, stageNumber } = req.params;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a completed treatment plan"
      });
    }

    const stage = treatmentPlan.stages.find(s => s.stageNumber == stageNumber);
    if (!stage) {
      return res.status(404).json({
        success: false,
        message: `Stage ${stageNumber} not found`
      });
    }

    // Check if stage has any completed procedures
    const hasCompletedProcedures = treatmentPlan.teeth.some(tooth =>
      tooth.procedures.some(
        proc => proc.stage == stageNumber && proc.status === "completed"
      )
    );

    if (hasCompletedProcedures) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove stage ${stageNumber} because it has completed procedures`
      });
    }

    // Remove procedures from this stage from all teeth
    treatmentPlan.teeth.forEach(tooth => {
      tooth.procedures = tooth.procedures.filter(
        proc => proc.stage != stageNumber
      );
    });

    // Remove empty teeth
    treatmentPlan.teeth = treatmentPlan.teeth.filter(
      tooth => tooth.procedures.length > 0
    );

    // Remove the stage
    treatmentPlan.stages = treatmentPlan.stages.filter(
      s => s.stageNumber != stageNumber
    );

    // Re-number remaining stages
    treatmentPlan.stages.sort((a, b) => a.stageNumber - b.stageNumber);
    treatmentPlan.stages.forEach((stage, index) => {
      const newStageNumber = index + 1;
      
      // Update stage number
      stage.stageNumber = newStageNumber;
      
      // Update stage name if it follows default pattern
      if (stage.stageName === `Stage ${stageNumber}`) {
        stage.stageName = `Stage ${newStageNumber}`;
      }
      
      // Update procedures in teeth to reflect new stage number
      treatmentPlan.teeth.forEach(tooth => {
        tooth.procedures.forEach(proc => {
          if (proc.stage == stageNumber) {
            proc.stage = newStageNumber;
          }
        });
      });
    });

    // Update current stage
    if (treatmentPlan.stages.length > 0) {
      treatmentPlan.currentStage = treatmentPlan.stages[0].stageNumber;
    } else {
      treatmentPlan.currentStage = 1;
    }

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: `Stage ${stageNumber} removed successfully`,
      treatmentPlan
    });

  } catch (error) {
    console.error("removeStage error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing stage",
      error: error.message
    });
  }
};
const removeTreatmentPlan = async (req, res) => {
  try {
    const { id: planId } = req.params;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    // Check if plan has any completed procedures
    const hasCompletedProcedures = treatmentPlan.teeth.some(tooth =>
      tooth.procedures.some(proc => proc.status === "completed")
    );

    if (hasCompletedProcedures && treatmentPlan.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete treatment plan with completed procedures. Mark as cancelled instead."
      });
    }

    // Remove plan from patient's treatmentPlans array
    await Patient.findByIdAndUpdate(
      treatmentPlan.patientId,
      { $pull: { treatmentPlans: planId } }
    );

    // Remove treatmentPlanId from any linked patient history
    await PatientHistory.updateMany(
      { treatmentPlanId: planId },
      { $unset: { treatmentPlanId: "" } }
    );

    // Delete the treatment plan
    await TreatmentPlan.findByIdAndDelete(planId);

    return res.status(200).json({
      success: true,
      message: "Treatment plan removed successfully"
    });

  } catch (error) {
    console.error("removeTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing treatment plan",
      error: error.message
    });
  }
};
const cancelTreatmentPlan = async (req, res) => {
  try {
    const { id: planId } = req.params;
    const { cancellationReason } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found"
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed treatment plan"
      });
    }

    // Update status to cancelled
    treatmentPlan.status = "cancelled";
    treatmentPlan.cancellationReason = cancellationReason || "No reason provided";
    treatmentPlan.cancelledAt = new Date();
    treatmentPlan.cancelledBy = doctorId;

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Treatment plan cancelled successfully",
      treatmentPlan
    });

  } catch (error) {
    console.error("cancelTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while cancelling treatment plan",
      error: error.message
    });
  }
};

export{ consultPatient , startTreatmentPlan,addStageToTreatmentPlan,updateProcedureStatus,completeStage,finishTreatmentPlan,removeProcedure,removeStage,removeTreatmentPlan,cancelTreatmentPlan };
// Helper function to update patient's dental chart
import mongoose from "mongoose";
import { TOOTH_CONDITIONS } from "../middleware/toothSurfaceAndConditions.js";
  

// Unified helper function to update dental chart
export const updatePatientDentalChart = async (patientId, dentalWork, visitId, doctorId, treatmentPlanId = null, session) => {
  const Patient = mongoose.model("Patient");
  const patient = await Patient.findById(patientId).session(session);
  
  if (!patient) {
    throw new Error("Patient not found");
  }
  
  console.log("🦷 Updating dental chart:", {
    patientId,
    teethCount: dentalWork.length,
    visitId,
    treatmentPlanId
  });
  
  // Use toObject() to get a plain JavaScript object
  const patientObj = patient.toObject();
  const dentalChart = patientObj.dentalChart || [];
  
  for (const toothWork of dentalWork) {
    const { toothNumber, conditions = [], surfaceConditions = [], procedures = [] } = toothWork;
    
    // Find existing tooth or create new one
    let toothRecord = dentalChart.find(t => t.toothNumber === toothNumber);
    
    if (!toothRecord) {
      // Create new tooth record
      toothRecord = {
        toothNumber,
        conditions: [],
        procedures: [],  // All dental work goes here
        lastUpdated: new Date(),
        lastUpdatedBy: doctorId,
        lastVisitId: visitId
      };
      dentalChart.push(toothRecord);
      console.log(`✅ Created new tooth record for tooth ${toothNumber}`);
    } else {
      console.log(`📝 Found existing tooth record for tooth ${toothNumber}`);
      toothRecord.lastVisitId = visitId;
    }
    
    // Handle general conditions (store as procedures with type="condition")
    conditions.forEach(condition => {
      if (!toothRecord.conditions.includes(condition)) {
        toothRecord.conditions.push(condition);
      }
      
      // Also add as a procedure for unified tracking
      const existingCondition = toothRecord.procedures.find(p => 
        p.type === "condition" && 
        p.name === condition && 
        p.surface === "entire"
      );
      
      if (!existingCondition) {
        toothRecord.procedures.push({
          type: "condition",
          name: condition,
          surface: "entire",
          conditionType: condition,
          status: "completed",  // Conditions are always "present"
          date: new Date(),
          performedBy: doctorId,
          visitIds: visitId ? [visitId] : [],
          treatmentPlanId: treatmentPlanId
        });
      }
    });
    
    // Handle surface conditions (convert to procedures)
    for (const surfaceCondition of surfaceConditions) {
      surfaceCondition.conditions.forEach(condition => {
        const existingProcedure = toothRecord.procedures.find(p => 
          p.type === "condition" &&
          p.name === condition &&
          p.surface === surfaceCondition.surface
        );
        
        if (!existingProcedure) {
          toothRecord.procedures.push({
            type: "condition",
            name: condition,
            surface: surfaceCondition.surface,
            conditionType: condition,
            status: "completed",
            date: new Date(),
            performedBy: doctorId,
            visitIds: visitId ? [visitId] : [],
            treatmentPlanId: treatmentPlanId
          });
        }
      });
    }
    
    // Handle treatment procedures (from treatment plan or consultation)
    for (const procedure of procedures) {
      // Determine procedure type
      const isCondition = TOOTH_CONDITIONS.includes(procedure.name);
      const procedureType = isCondition ? "condition" : "treatment";
      
      // Check for existing similar procedure
      const existingProcedure = toothRecord.procedures.find(p => 
        p.name === procedure.name &&
        p.surface === procedure.surface &&
        p.type === procedureType &&
        (p.treatmentPlanId?.toString() === treatmentPlanId?.toString() || 
         p.status !== procedure.status)  // Different status means different instance
      );
      
      if (existingProcedure) {
        // Update existing procedure
        if (procedure.status === "completed" && existingProcedure.status !== "completed") {
          // Mark as completed
          existingProcedure.status = "completed";
          existingProcedure.performedBy = doctorId;
          existingProcedure.date = new Date();
          existingProcedure.cost = procedure.cost || existingProcedure.cost;
          existingProcedure.notes = procedure.notes || existingProcedure.notes;
          
          // Remove from estimated cost
          existingProcedure.estimatedCost = undefined;
          
          console.log(`✅ Completed procedure ${procedure.name} for tooth ${toothNumber}`);
        } else if (procedure.status === "planned") {
          // Update planned procedure
          existingProcedure.estimatedCost = procedure.estimatedCost || existingProcedure.estimatedCost;
          existingProcedure.notes = procedure.notes || existingProcedure.notes;
          
          console.log(`📝 Updated planned procedure ${procedure.name} for tooth ${toothNumber}`);
        }
      } else {
        // Add new procedure
        const newProcedure = {
          type: procedureType,
          name: procedure.name,
          surface: procedure.surface,
          status: procedure.status,
          notes: procedure.notes || "",
          date: new Date(),
          performedBy: doctorId,
          visitIds: visitId ? [visitId] : [],
          treatmentPlanId: treatmentPlanId
        };
        
        // Add type-specific fields
        if (isCondition) {
          newProcedure.conditionType = procedure.name;
        } else {
          newProcedure.procedureType = procedure.name.toLowerCase().replace(/\s+/g, '-');
        }
        
        if (procedure.status === "completed") {
          newProcedure.cost = procedure.cost || 0;
          console.log(`✅ Added completed ${procedureType} ${procedure.name} for tooth ${toothNumber}`);
        } else if (procedure.status === "planned") {
          newProcedure.estimatedCost = procedure.estimatedCost || 0;
          console.log(`📋 Added planned ${procedureType} ${procedure.name} for tooth ${toothNumber}`);
        }
        
        toothRecord.procedures.push(newProcedure);
      }
    }
    
    toothRecord.lastUpdated = new Date();
    toothRecord.lastUpdatedBy = doctorId;
  }
  
  // Clean up: Ensure no duplicate procedures
  dentalChart.forEach(tooth => {
    if (tooth.procedures && tooth.procedures.length > 0) {
      const uniqueProcedures = [];
      const seen = new Set();
      
      tooth.procedures.forEach(proc => {
        const key = `${proc.type}-${proc.name}-${proc.surface}-${proc.status}-${proc.treatmentPlanId}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueProcedures.push(proc);
        }
      });
      
      tooth.procedures = uniqueProcedures;
    }
  });
  
  // Update patient document
  try {
    await Patient.findByIdAndUpdate(
      patientId,
      { 
        $set: { 
          dentalChart: dentalChart,
          ...(patientObj.visitHistory && { visitHistory: patientObj.visitHistory }),
          ...(patientObj.treatmentPlans && { treatmentPlans: patientObj.treatmentPlans })
        }
      },
      { session, new: true }
    );
    console.log("✅ Unified dental chart updated successfully");
  } catch (error) {
    console.error("❌ Failed to save dental chart:", error.message);
    throw error;
  }
  
  return patient;
};

// Helper function that takes the patient document directly
export const updatePatientDentalChart = async (patient, dentalWork, visitId, doctorId, treatmentPlanId = null, session) => {
  if (!patient) {
    throw new Error("Patient not found");
  }
  
  console.log("🦷 Updating dental chart:", {
    patientId: patient._id,
    teethCount: dentalWork.length,
    visitId,
    treatmentPlanId
  });
  
  // Initialize dentalChart if it doesn't exist
  if (!patient.dentalChart) {
    patient.dentalChart = [];
  }
  
  for (const toothWork of dentalWork) {
    const { toothNumber, conditions = [], surfaceConditions = [], procedures = [] } = toothWork;
    
    // Find existing tooth or create new one
    let toothRecord = patient.dentalChart.find(t => t.toothNumber === toothNumber);
    
    if (!toothRecord) {
      // Create new tooth record
      toothRecord = {
        toothNumber,
        conditions: [],
        procedures: [],
        lastUpdated: new Date(),
        lastUpdatedBy: doctorId,
        lastVisitId: visitId
      };
      patient.dentalChart.push(toothRecord);
      // Get reference to the newly added subdocument
      toothRecord = patient.dentalChart[patient.dentalChart.length - 1];
      console.log(`✅ Created new tooth record for tooth ${toothNumber}`);
    } else {
      console.log(`📝 Found existing tooth record for tooth ${toothNumber}`);
      toothRecord.lastVisitId = visitId;
    }
    
    // Handle general tooth conditions (stored as strings)
    conditions.forEach(condition => {
      if (condition && !toothRecord.conditions.includes(condition)) {
        toothRecord.conditions.push(condition);
        console.log(`✅ Added condition: ${condition} to tooth ${toothNumber}`);
      }
    });
    
    // Handle surface conditions
    for (const surfaceCondition of surfaceConditions) {
      const { surface, conditions: surfaceConds = [] } = surfaceCondition;
      
      surfaceConds.forEach(condition => {
        // Store surface-specific conditions in procedures array
        const existingProcedure = toothRecord.procedures.find(p => 
          p.type === "condition" &&
          p.name === condition &&
          p.surface === surface
        );
        
        if (!existingProcedure) {
          toothRecord.procedures.push({
            type: "condition",
            name: condition,
            surface: surface,
            status: "present",
            date: new Date(),
            performedBy: doctorId,
            visitIds: visitId ? [visitId] : [],
            treatmentPlanId: treatmentPlanId,
            notes: ""
          });
          console.log(`✅ Added surface condition: ${condition} on tooth ${toothNumber} (${surface})`);
        }
      });
    }
    
    // Handle treatment procedures
    for (const procedure of procedures) {
      // Check for existing procedure
      const existingProcedure = toothRecord.procedures.find(p => 
        p.name === procedure.name &&
        p.surface === procedure.surface &&
        p.type === "treatment" &&
        (treatmentPlanId ? p.treatmentPlanId?.toString() === treatmentPlanId.toString() : !p.treatmentPlanId)
      );
      
      if (existingProcedure) {
        // Update existing procedure
        if (procedure.status === "completed" && existingProcedure.status !== "completed") {
          existingProcedure.status = "completed";
          existingProcedure.performedBy = doctorId;
          existingProcedure.date = new Date();
          existingProcedure.cost = procedure.cost || existingProcedure.cost;
          existingProcedure.notes = procedure.notes || existingProcedure.notes;
          
          // Add visitId if not already present
          if (visitId && !existingProcedure.visitIds?.includes(visitId)) {
            existingProcedure.visitIds = existingProcedure.visitIds || [];
            existingProcedure.visitIds.push(visitId);
          }
          
          console.log(`✅ Completed procedure: ${procedure.name} on tooth ${toothNumber} (${procedure.surface})`);
        } else if (procedure.status === "planned" || procedure.status === "in-progress") {
          existingProcedure.status = procedure.status;
          existingProcedure.estimatedCost = procedure.estimatedCost || existingProcedure.estimatedCost;
          existingProcedure.notes = procedure.notes || existingProcedure.notes;
          console.log(`📝 Updated ${procedure.status} procedure: ${procedure.name} on tooth ${toothNumber}`);
        }
      } else {
        // Add new procedure
        const newProcedure = {
          type: "treatment",
          name: procedure.name,
          surface: procedure.surface || "entire",
          status: procedure.status || "planned",
          notes: procedure.notes || "",
          date: new Date(),
          performedBy: doctorId,
          visitIds: visitId ? [visitId] : [],
          treatmentPlanId: treatmentPlanId
        };
        
        // Add cost fields based on status
        if (procedure.status === "completed") {
          newProcedure.cost = procedure.cost || 0;
          console.log(`✅ Added completed treatment: ${procedure.name} on tooth ${toothNumber}`);
        } else {
          newProcedure.estimatedCost = procedure.estimatedCost || 0;
          console.log(`📋 Added planned treatment: ${procedure.name} on tooth ${toothNumber} (Stage ${procedure.stage || 1})`);
        }
        
        toothRecord.procedures.push(newProcedure);
      }
    }
    
    toothRecord.lastUpdated = new Date();
    toothRecord.lastUpdatedBy = doctorId;
  }
  
  // ✅ Don't save here - let the main function save
  console.log("✅ Dental chart updated in memory");
  
  return patient;
};
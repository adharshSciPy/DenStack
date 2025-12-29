import Patient from "../model/patientSchema.js";
import PatientHistory from "../model/patientHistorySchema.js";
import TreatmentPlan from "../model/treatmentPlanSchema.js";
import mongoose from "mongoose";

// ✅ Get complete dental chart for a patient
export const getPatientDentalChart = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findById(patientId)
      .select("dentalChart name patientUniqueId")
    //   .populate("dentalChart.performedBy", "name specialization")
      .populate("dentalChart.visitId", "visitDate")
      .populate("dentalChart.treatmentPlanId", "planName")
    //   .populate("dentalChart.lastModifiedBy", "name");

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    const sortedChart = patient.dentalChart.sort((a, b) => a.toothNumber - b.toothNumber);

    res.status(200).json({
      success: true,
      data: {
        patientId: patient._id,
        patientName: patient.name,
        patientUniqueId: patient.patientUniqueId,
        dentalChart: sortedChart,
        totalTeethRecorded: sortedChart.length
      }
    });

  } catch (error) {
    console.error("Error fetching dental chart:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dental chart",
      error: error.message
    });
  }
};


// ✅ Get history of a specific tooth
export const getToothHistory = async (req, res) => {
  try {
    const { patientId, toothNumber } = req.params;

    const patient = await Patient.findById(patientId)
      .populate('dentalChart.procedures.performedBy', 'name specialization')
      .populate('dentalChart.procedures.visitId', 'visitDate');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    const toothHistory = patient.getToothHistory(parseInt(toothNumber));

    res.status(200).json({
      success: true,
      data: toothHistory
    });

  } catch (error) {
    console.error("Error fetching tooth history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tooth history",
      error: error.message
    });
  }
};

// ✅ Add procedure to dental chart (with conflict detection)
export const addDentalProcedure = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { patientId, visitId } = req.params;
    const { toothNumber, procedureName, surface, notes, treatmentPlanId } = req.body;
    const doctorId = req.user._id; // from auth middleware

    // Validate required fields
    if (!toothNumber || !procedureName || !surface) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Missing required fields: toothNumber, procedureName, surface"
      });
    }

    // Fetch patient
    const patient = await Patient.findById(patientId).session(session);
    if (!patient) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Fetch visit record
    const visit = await PatientHistory.findById(visitId).session(session);
    if (!visit) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Visit record not found"
      });
    }

    // ✅ CHECK FOR CONFLICTS
    try {
      const procedureData = {
        procedureName,
        surface,
        performedBy: doctorId,
        visitId,
        treatmentPlanId,
        notes,
        status: 'completed'
      };

      // This will throw error if surface already treated
      const newProcedure = patient.addDentalProcedure(toothNumber, procedureData);

      // Save patient with updated dental chart
      await patient.save({ session });

      // Update visit record with procedure
      visit.procedures.push({
        toothNumber,
        procedureName,
        surface,
        description: notes,
        fee: req.body.fee || 0,
        notes
      });

      // Create snapshot of current dental chart in visit
      visit.dentalChartSnapshot = patient.dentalChart.map(tooth => ({
        toothNumber: tooth.toothNumber,
        status: tooth.currentStatus,
        notes: tooth.generalNotes,
        procedures: tooth.procedures.slice(-5) // last 5 procedures
      }));

      await visit.save({ session });

      // If part of treatment plan, mark procedure as completed
      if (treatmentPlanId) {
        const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId).session(session);
        if (treatmentPlan) {
          // Find and mark procedure completed in treatment plan
          for (const stage of treatmentPlan.stages) {
            const procedure = stage.procedures.find(
              p => p.toothNumber === toothNumber && 
                   p.surface === surface && 
                   p.name === procedureName
            );
            if (procedure && !procedure.completed) {
              procedure.completed = true;
              procedure.completedAt = new Date();
              procedure.completedInVisitId = visitId;
            }
          }
          await treatmentPlan.save({ session });
        }
      }

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: "Procedure added successfully",
        data: {
          procedure: newProcedure,
          toothNumber,
          visitId
        }
      });

    } catch (conflictError) {
      await session.abortTransaction();
      
      // Return conflict error with details
      return res.status(409).json({
        success: false,
        message: conflictError.message,
        errorType: "SURFACE_CONFLICT",
        details: {
          toothNumber,
          surface,
          suggestion: "This surface has already been treated. Please review the dental chart or select a different surface."
        }
      });
    }

  } catch (error) {
    await session.abortTransaction();
    console.error("Error adding dental procedure:", error);
    res.status(500).json({
      success: false,
      message: "Error adding dental procedure",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ Update tooth status (e.g., after extraction, crown placement)
export const updateToothStatus = async (req, res) => {
  try {
    const { patientId, toothNumber } = req.params;
    const { status, notes } = req.body;
    const doctorId = req.user._id;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    const tooth = patient.dentalChart.find(t => t.toothNumber === parseInt(toothNumber));
    
    if (!tooth) {
      return res.status(404).json({
        success: false,
        message: `Tooth ${toothNumber} not found in dental chart`
      });
    }

    tooth.currentStatus = status;
    if (notes) {
      tooth.generalNotes = notes;
    }
    tooth.lastModifiedAt = new Date();
    tooth.lastModifiedBy = doctorId;

    await patient.save();

    res.status(200).json({
      success: true,
      message: "Tooth status updated successfully",
      data: tooth
    });

  } catch (error) {
    console.error("Error updating tooth status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating tooth status",
      error: error.message
    });
  }
};

// ✅ Get dental chart comparison (before/after treatment plan)
export const getDentalChartComparison = async (req, res) => {
  try {
    const { patientId, treatmentPlanId } = req.params;

    const patient = await Patient.findById(patientId).select('dentalChart');
    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);

    if (!patient || !treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Patient or Treatment Plan not found"
      });
    }

    const comparison = {
      currentState: patient.dentalChart,
      plannedWork: treatmentPlan.dentalChart,
      completedWork: treatmentPlan.dentalChart.filter(item => item.isCompleted)
    };

    res.status(200).json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error("Error getting dental chart comparison:", error);
    res.status(500).json({
      success: false,
      message: "Error getting comparison",
      error: error.message
    });
  }
};

// ✅ Check for procedure conflicts before adding
export const checkProcedureConflict = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { toothNumber, surface } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    const hasConflict = patient.isSurfaceTreated(toothNumber, surface);
    
    if (hasConflict) {
      const tooth = patient.dentalChart.find(t => t.toothNumber === toothNumber);
      const surfaceInfo = tooth?.treatedSurfaces.find(ts => ts.surface === surface);

      return res.status(200).json({
        success: true,
        hasConflict: true,
        message: `Surface '${surface}' of tooth ${toothNumber} has already been treated`,
        details: {
          lastTreatedAt: surfaceInfo?.lastTreatedAt,
          lastProcedure: surfaceInfo?.lastProcedure,
          allTreatedSurfaces: tooth?.treatedSurfaces
        }
      });
    }

    res.status(200).json({
      success: true,
      hasConflict: false,
      message: "No conflict detected. Procedure can be performed."
    });

  } catch (error) {
    console.error("Error checking procedure conflict:", error);
    res.status(500).json({
      success: false,
      message: "Error checking conflict",
      error: error.message
    });
  }
};

export default {
  getPatientDentalChart,
  getToothHistory,
  addDentalProcedure,
  updateToothStatus,
  getDentalChartComparison,
  checkProcedureConflict
};
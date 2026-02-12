import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import Patient from "../model/patientSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import TreatmentPlan from "../model/treatmentPlanSchema.js";
import{ updatePatientDentalChart} from "../helper/updatePatientDentalChart.js";
import authBaseUrl from "../authServiceBaseUrl.js";
import { findOrCreateMedicine, cleanMedicineName } from '../utils/medicineUtils.js';

dotenv.config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;
const consultPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: appointmentId } = req.params;
    const doctorId = req.doctorId;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });
    }

    if (!doctorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ---------- helpers ----------
    const parseJSON = (v, d = []) =>
      v == null ? d : typeof v === "string" ? JSON.parse(v) : v;

    // ---------- 🟢 CHANGE 1: ADD NEW FIELDS FROM FRONTEND ----------
    // Previously only had 'symptoms' - now we have chiefComplaints, examinationFindings, dentalHistory
    const chiefComplaints = parseJSON(req.body.chiefComplaints || req.body.symptoms, []);
    const examinationFindings = parseJSON(req.body.examinationFindings, []);
    const dentalHistory = parseJSON(req.body.dentalHistory, []);
    
    // Keep existing fields
    const diagnosis = parseJSON(req.body.diagnosis, []);
    const prescriptionsRaw = parseJSON(req.body.prescriptions, []);
    const files = parseJSON(req.body.files, []);
    const plannedProcedures = parseJSON(req.body.plannedProcedures, []);
    const performedTeeth = parseJSON(req.body.performedTeeth, []);
    const treatmentPlanInput = parseJSON(req.body.treatmentPlan, null);
    const treatmentPlanStatusUpdate = parseJSON(
      req.body.treatmentPlanStatus,
      null,
    );
    const recall = parseJSON(req.body.recall, null);
    const notes = req.body.notes || "";
    const softTissueInput = parseJSON(req.body.softTissueExamination, []);
    const tmjInput = parseJSON(req.body.tmjExamination, []);

    console.log("📥 ========== CONSULTATION REQUEST RECEIVED ==========");
    // 🟢 ADD: Log new fields
    console.log("Chief Complaints:", chiefComplaints.length);
    console.log("Examination Findings:", examinationFindings.length);
    console.log("Dental History:", dentalHistory.length);
    
    console.log(
      "📋 Treatment Plan Input:",
      treatmentPlanInput
        ? {
            planName: treatmentPlanInput.planName,
            teethCount: treatmentPlanInput.teeth?.length || 0,
            stagesCount: treatmentPlanInput.stages?.length || 0,
            startToday: treatmentPlanInput.startToday,
          }
        : "No treatment plan",
    );

    // Log detailed stage information from frontend
    if (treatmentPlanInput?.stages) {
      console.log("📊 STAGES RECEIVED FROM FRONTEND:");
      treatmentPlanInput.stages.forEach((stage, index) => {
        console.log(`  Stage ${index + 1}:`);
        console.log(`    Name: ${stage.stageName}`);
        console.log(`    Status from frontend: ${stage.status || "pending"}`);
        console.log(`    Scheduled Date: ${stage.scheduledDate}`);
        console.log(`    Procedure Refs: ${stage.procedureRefs?.length || 0}`);
      });
    }

    // ---------- MEDICINE AUTO-SUGGESTION & AUTO-CREATION ----------
    const processPrescriptions = async (prescriptionsRaw) => {
      const processedPrescriptions = [];
      
      for (const prescription of prescriptionsRaw) {
        const medicineName = prescription.medicineName || prescription.medicine;
        
        if (medicineName && medicineName.trim().length >= 3) {
          // Find or create medicine in master database
          const medicineData = await findOrCreateMedicine(medicineName, doctorId, appointment.clinicId);
          
          // Add medicine data to prescription
          processedPrescriptions.push({
            medicineName: medicineData?.name || medicineName,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            duration: prescription.duration,
            medicineId: medicineData?._id
          });
        } else {
          processedPrescriptions.push({
            medicineName: medicineName,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            duration: prescription.duration
          });
        }
      }
      
      return processedPrescriptions;
    };

    // ---------- fetch appointment ----------
    const appointment =
      await Appointment.findById(appointmentId).session(session);
    if (!appointment || appointment.status === "cancelled") {
      return res
        .status(404)
        .json({ success: false, message: "Invalid appointment" });
    }

    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Doctor mismatch" });
    }

    const patient = await Patient.findById(appointment.patientId).session(
      session,
    );
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }
    
    // FIX: Fetch fresh patient instance to avoid version conflicts
    const freshPatient = await Patient.findById(appointment.patientId).session(session);
    if (!freshPatient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // ---------- Process prescriptions with auto-creation ----------
    const prescriptions = await processPrescriptions(prescriptionsRaw);

    // ---------- fetch consultation fee ----------
    let consultationFee = 0;

    try {
      const doctorsResp = await axios.get(
        `${CLINIC_SERVICE_BASE_URL}/active-doctors`,
        { params: { clinicId: appointment.clinicId } },
      );

      const doctorData = doctorsResp.data?.doctors?.find(
        (d) => d.doctorId?.toString() === doctorId.toString(),
      );

      consultationFee = doctorData?.standardConsultationFee ?? 0;
    } catch (err) {
      console.error("⚠️ Failed to fetch consultation fee:", err.message);
    }

    // ---------- files ----------
    const uploadedFiles = (req.files || []).map((f) => ({
      url: `/uploads/${f.filename}`,
      type: f.mimetype.includes("image")
        ? "image"
        : f.mimetype.includes("pdf")
          ? "pdf"
          : "other",
      uploadedAt: new Date(),
    }));

    const allFiles = [...files, ...uploadedFiles];

    // ---------- CREATE VISIT ----------
    const dentalWork = performedTeeth.map((t) => ({
      toothNumber: t.toothNumber,
      conditions: t.conditions || [],
      surfaceConditions: (t.surfaceConditions || []).map((sc) => ({
        surface: sc.surface,
        conditions: sc.conditions || [],
      })),
      procedures: (t.procedures || []).map((p) => ({
        name: p.name,
        surface: p.surface,
        status: p.status || "completed",
        cost: p.cost,
        notes: p.notes,
        performedBy: doctorId,
        performedAt: new Date(),
      })),
    }));

    console.log("🦷 Performed Teeth Data:", {
      count: performedTeeth.length,
      proceduresCount: performedTeeth.reduce(
        (sum, t) => sum + (t.procedures?.length || 0),
        0,
      ),
    });
    
    const softTissueExamination = softTissueInput.map((st) => ({
      id: st.id,
      name: st.name,
      onExamination: (st.onExamination || []).map((e) => ({
        value: e.value,
        isCustom: !!e.isCustom,
      })),
      diagnosis: (st.diagnosis || []).map((d) => ({
        value: d.value,
        isCustom: !!d.isCustom,
      })),
      treatment: (st.treatment || []).map((t) => ({
        value: t.value,
        isCustom: !!t.isCustom,
      })),
      notes: st.notes || "",
    }));
    
    const tmjExamination = tmjInput.map((tmj) => ({
      id: tmj.id,
      name: tmj.name,
      onExamination: (tmj.onExamination || []).map((e) => ({
        value: e.value,
        isCustom: !!e.isCustom,
      })),
      diagnosis: (tmj.diagnosis || []).map((d) => ({
        value: d.value,
        isCustom: !!d.isCustom,
      })),
      treatment: (tmj.treatment || []).map((t) => ({
        value: t.value,
        isCustom: !!t.isCustom,
      })),
      notes: tmj.notes || "",
    }));

    // 🟢 CHANGE 2: ADD THE 3 NEW FIELDS TO THE VISIT DOCUMENT CREATION
    const [visitDoc] = await PatientHistory.create(
      [
        {
          patientId: appointment.patientId,
          clinicId: appointment.clinicId,
          doctorId,
          appointmentId,
          // 🟢 REPLACE 'symptoms' with 'chiefComplaints' (or keep both for backward compatibility)
          symptoms: chiefComplaints.map(c => c.value || c.name || c), // Keep for backward compatibility
          chiefComplaints: chiefComplaints.map(c => ({
            value: c.value || c.name || c,
            isCustom: c.isCustom || false,
            code: c.code,
            category: c.category,
            selectedAt: c.selectedAt ? new Date(c.selectedAt) : new Date()
          })),
          // 🟢 ADD examinationFindings
          examinationFindings: examinationFindings.map(e => ({
            value: e.value || e.name || e,
            isCustom: e.isCustom || false,
            code: e.code,
            category: e.category,
            selectedAt: e.selectedAt ? new Date(e.selectedAt) : new Date()
          })),
          // 🟢 ADD dentalHistory
          dentalHistory: dentalHistory.map(d => ({
            value: d.value || d.name || d,
            isCustom: d.isCustom || false,
            code: d.code,
            category: d.category,
            selectedAt: d.selectedAt ? new Date(d.selectedAt) : new Date()
          })),
          diagnosis,
          prescriptions,
          notes,
          files: allFiles,
          dentalWork,
          softTissueExamination,
          tmjExamination,
          plannedProcedures,
          consultationFee,
          createdBy: doctorId,
        },
      ],
      { session },
    );

    console.log("✅ Visit created:", visitDoc._id);

    let treatmentPlan = null;
    let updatedExistingPlan = false;

    // ---------- UPDATE DENTAL CHART WITH PERFORMED PROCEDURES FIRST ----------
    if (dentalWork.length > 0) {
      console.log("🦷 Updating patient's dental chart with performed work");
      await updatePatientDentalChart(
        appointment.patientId,
        dentalWork,
        visitDoc._id,
        doctorId,
        null,
        session
      );
    }

    // ---------- CHECK FOR EXISTING TREATMENT PLAN TO UPDATE ----------
    if (treatmentPlanStatusUpdate?.planId) {
      console.log("🔄 Updating existing treatment plan status");

      treatmentPlan = await TreatmentPlan.findById(
        treatmentPlanStatusUpdate.planId,
      ).session(session);
      if (!treatmentPlan) {
        throw new Error("Treatment plan not found");
      }

      console.log("📋 Existing plan found:", {
        planName: treatmentPlan.planName,
        currentStatus: treatmentPlan.status,
        stagesCount: treatmentPlan.stages.length,
      });

      // Update stage completion if specified
      if (treatmentPlanStatusUpdate.completedStageNumber) {
        const stageNumber = treatmentPlanStatusUpdate.completedStageNumber;
        const stage = treatmentPlan.stages.find(
          (s) => s.stageNumber == stageNumber,
        );

        console.log(
          `🎯 Completing Stage ${stageNumber}:`,
          stage ? stage.stageName : "Not found",
        );

        if (stage && stage.status !== "completed") {
          // Complete all procedures in this stage
          treatmentPlan.teeth.forEach((tooth) => {
            tooth.procedures.forEach((procedure) => {
              if (
                procedure.stage == stageNumber &&
                procedure.status !== "completed"
              ) {
                procedure.status = "completed";
                procedure.completedAt = new Date();
                procedure.completedInVisitId = visitDoc._id;
                procedure.performedBy = doctorId;
                console.log(
                  `✅ Marked procedure ${procedure.name} as completed`,
                );
              }
            });

            // Check if all procedures for this tooth are completed
            const toothProcedures = tooth.procedures.filter(
              (p) => p.status === "completed",
            );
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
      if (treatmentPlanStatusUpdate?.completedProcedures?.length > 0) {
        console.log("🔧 Updating specific procedures:", treatmentPlanStatusUpdate.completedProcedures);
        
        // Collect completed procedures for dental chart update
        const completedProceduresForChart = [];
        
        treatmentPlanStatusUpdate.completedProcedures.forEach((procUpdate) => {
          const tooth = treatmentPlan.teeth.find(
            t => t.toothNumber == procUpdate.toothNumber
          );
          if (tooth) {
            const procedure = tooth.procedures.find(
              p => p.name === procUpdate.procedureName &&
              p.surface === procUpdate.surface &&
              p.stage == procUpdate.stageNumber
            );

            if (procedure && procedure.status !== "completed") {
              procedure.status = "completed";
              procedure.completedAt = new Date();
              procedure.completedInVisitId = visitDoc._id;
              procedure.performedBy = doctorId;
              
              // Add to dental chart update list
              completedProceduresForChart.push({
                toothNumber: procUpdate.toothNumber,
                conditions: [],
                surfaceConditions: [],
                procedures: [{
                  name: procUpdate.procedureName,
                  surface: procUpdate.surface,
                  status: "completed",
                  performedAt: new Date(),
                  performedBy: doctorId,
                  cost: 0,
                  notes: ""
                }]
              });
            }
          }
        });
        
        // Update dental chart with completed procedures
        if (completedProceduresForChart.length > 0) {
          await updatePatientDentalChart(
            appointment.patientId,
            completedProceduresForChart,
            visitDoc._id,
            doctorId,
            treatmentPlan._id,
            session
          );
        }
      }

      // Update overall plan status
      treatmentPlan.updatePlanStatus();

      // Update stage statuses based on completed procedures
      console.log("📊 Updating stage statuses:");
      treatmentPlan.stages.forEach((stage) => {
        const proceduresInStage = treatmentPlan.teeth.flatMap((tooth) =>
          tooth.procedures.filter((p) => p.stage == stage.stageNumber),
        );

        const completedCount = proceduresInStage.filter(
          (p) => p.status === "completed",
        ).length;
        const totalCount = proceduresInStage.length;

        console.log(`  Stage ${stage.stageNumber} (${stage.stageName}):`);
        console.log(
          `    Procedures: ${completedCount}/${totalCount} completed`,
        );
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
      const teethData = (treatmentPlanInput.teeth || []).map((toothPlan) => ({
        toothNumber: toothPlan.toothNumber,
        priority: toothPlan.priority || "medium",
        isCompleted: false,
        procedures: toothPlan.procedures.map((proc) => ({
          name: proc.name,
          surface: proc.surface || "occlusal",
          stage: proc.stage || 1,
          estimatedCost: proc.estimatedCost || 0,
          notes: proc.notes || "",
          status: proc.status || "planned",
        })),
      }));

      // Log procedures with statuses
      console.log("🦷 Teeth Data with Procedure Statuses:");
      teethData.forEach((tooth) => {
        console.log(`  Tooth ${tooth.toothNumber}:`);
        tooth.procedures.forEach((proc) => {
          console.log(
            `    - ${proc.name} (Stage ${proc.stage}): ${proc.status}`,
          );
        });
      });

      // Process stages data with toothSurfaceProcedures
      const stagesData = (treatmentPlanInput.stages || []).map(
        (stageInput, index) => {
          const stageNumber = index + 1;

          console.log(`📋 Processing Stage ${stageNumber} from frontend:`);
          console.log(`  Name: ${stageInput.stageName}`);
          console.log(
            `  Status from frontend: ${stageInput.status || "pending"}`,
          );
          console.log(`  Scheduled Date: ${stageInput.scheduledDate}`);

          // Build toothSurfaceProcedures for this stage
          const toothSurfaceProcedures = [];

          // Group procedures by tooth and surface for this stage
          const proceduresByToothAndSurface = {};

          teethData.forEach((tooth) => {
            // Get procedures for this stage
            const stageProcedures = tooth.procedures.filter(
              (p) => p.stage === stageNumber,
            );

            if (stageProcedures.length > 0) {
              const toothKey = tooth.toothNumber;
              proceduresByToothAndSurface[toothKey] = {};

              // Group by surface
              stageProcedures.forEach((proc) => {
                const surfaceKey = proc.surface;
                if (!proceduresByToothAndSurface[toothKey][surfaceKey]) {
                  proceduresByToothAndSurface[toothKey][surfaceKey] = new Set();
                }
                proceduresByToothAndSurface[toothKey][surfaceKey].add(
                  proc.name,
                );
              });
            }
          });

          // Convert to toothSurfaceProcedures format
          Object.entries(proceduresByToothAndSurface).forEach(
            ([toothNumStr, surfaces]) => {
              const toothNumber = parseInt(toothNumStr);
              const surfaceProcedures = Object.entries(surfaces).map(
                ([surface, procedureNamesSet]) => ({
                  surface: surface,
                  procedureNames: Array.from(procedureNamesSet),
                }),
              );

              toothSurfaceProcedures.push({
                toothNumber: toothNumber,
                surfaceProcedures: surfaceProcedures,
              });
            },
          );

          // Use status from frontend
          const stageStatus = stageInput.status || "pending";

          console.log(`  Using status: ${stageStatus} (from frontend)`);
          console.log(
            `  Tooth-Surface Procedures: ${toothSurfaceProcedures.length} entries`,
          );

          return {
            stageNumber: stageNumber,
            stageName: stageInput.stageName || `Stage ${stageNumber}`,
            description: stageInput.description || "",
            status: stageStatus,
            scheduledDate: stageInput.scheduledDate
              ? new Date(stageInput.scheduledDate)
              : null,
            toothSurfaceProcedures: toothSurfaceProcedures,
            notes: stageInput.notes || "",
            ...(stageStatus === "in-progress" && { startedAt: new Date() }),
            ...(stageStatus === "completed" && { completedAt: new Date() }),
          };
        },
      );

      // ---------- 🟢 CHANGE 3: FIX THE BUG IN PLAN STATUS CALCULATION ----------
      // Original code had a bug where "completed" would never be set
      let planStatus = "draft";
      
      // Fix: Check for completed stages FIRST
      const allStagesCompleted = stagesData.length > 0 && 
        stagesData.every((stage) => stage.status === "completed");
      
      if (allStagesCompleted) {
        planStatus = "completed";
      } else if (stagesData.some(stage => 
        stage.status === "in-progress" || stage.status === "completed")) {
        planStatus = "ongoing";
      }
      // Otherwise stays "draft"

      console.log(`📊 Calculated plan status: ${planStatus}`);

      // Create treatment plan
      [treatmentPlan] = await TreatmentPlan.create(
        [
          {
            patientId: appointment.patientId,
            clinicId: appointment.clinicId,
            createdByDoctorId: doctorId,
            planName: treatmentPlanInput.planName.trim(),
            description: treatmentPlanInput.description?.trim() || "",
            teeth: teethData,
            stages: stagesData,
            status: planStatus,
            currentStage: 1,
            startedAt:
              planStatus === "ongoing" || planStatus === "completed"
                ? new Date()
                : null,
            completedAt: planStatus === "completed" ? new Date() : null,
          },
        ],
        { session },
      );

      console.log("✅ Treatment plan created:", {
        planName: treatmentPlan.planName,
        teethCount: treatmentPlan.teeth.length,
        stagesCount: treatmentPlan.stages.length,
        status: treatmentPlan.status,
        totalProcedures: treatmentPlan.teeth.reduce(
          (sum, t) => sum + t.procedures.length,
          0,
        ),
      });

      // Log final stage statuses
      console.log("📊 FINAL STAGE STATUSES SAVED TO DATABASE:");
      treatmentPlan.stages.forEach((stage, index) => {
        console.log(
          `  Stage ${index + 1}: ${stage.stageName} - Status: ${stage.status}`,
        );
      });

      // Add treatment plan procedures to dental chart
      const treatmentPlanProcedures = [];
      
      treatmentPlan.teeth.forEach((toothPlan) => {
        const dentalWorkEntry = {
          toothNumber: toothPlan.toothNumber,
          conditions: [],
          surfaceConditions: [],
          procedures: toothPlan.procedures.map((proc) => ({
            name: proc.name,
            surface: proc.surface,
            status: "planned",
            estimatedCost: proc.estimatedCost || 0,
            notes: proc.notes || ""
          }))
        };
        
        treatmentPlanProcedures.push(dentalWorkEntry);
      });

      if (treatmentPlanProcedures.length > 0) {
        console.log("📋 Adding treatment plan procedures to dental chart");
        await updatePatientDentalChart(
          appointment.patientId,
          treatmentPlanProcedures,
          null,
          doctorId,
          treatmentPlan._id,
          session
        );
      }

      // Link to patient
      if (!freshPatient.treatmentPlans) {
        freshPatient.treatmentPlans = [];
      }
      freshPatient.treatmentPlans.push(treatmentPlan._id);
      await freshPatient.save({ session });
    }

    // ---------- HANDLE PERFORMED PROCEDURES FROM TREATMENT PLAN ----------
    if (treatmentPlan && !updatedExistingPlan && performedTeeth.length > 0) {
      console.log("🔄 Updating newly created treatment plan with performed procedures");
      
      for (const toothWork of performedTeeth) {
        const toothPlan = treatmentPlan.teeth.find(
          t => t.toothNumber === toothWork.toothNumber
        );
        
        if (!toothPlan) continue;
        
        toothWork.procedures?.forEach((performedProc) => {
          const plannedProc = toothPlan.procedures.find(p =>
            p.name === performedProc.name &&
            p.surface === performedProc.surface &&
            p.stage === 1
          );
          
          if (plannedProc && plannedProc.status !== "completed") {
            plannedProc.status = "completed";
            plannedProc.completedAt = new Date();
            plannedProc.completedInVisitId = visitDoc._id;
            plannedProc.performedBy = doctorId;
            
            console.log(`✅ Procedure ${plannedProc.name} marked as completed in treatment plan`);
          }
        });
      }
      
      treatmentPlan.updatePlanStatus();
      await treatmentPlan.save({ session });
    }

    // ---------- link visit to treatment plan ----------
    if (treatmentPlan) {
      visitDoc.treatmentPlanId = treatmentPlan._id;
      await visitDoc.save({ session });
      console.log("🔗 Visit linked to treatment plan");
    }

    // ---------- recall ----------
    if (recall?.appointmentDate && recall?.appointmentTime) {
      await Appointment.create(
        [
          {
            patientId: appointment.patientId,
            clinicId: appointment.clinicId,
            doctorId: appointment.doctorId,
            appointmentDate: recall.appointmentDate,
            appointmentTime: recall.appointmentTime,
            status: "recall",
            createdBy: doctorId,
            department: appointment.department,
            rescheduledFromOp: appointment.opNumber,
            visitId: visitDoc._id,
          },
        ],
        { session },
      );
      console.log("📅 Recall appointment created");
    }

    // ---------- finalize ----------
    await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: "completed", visitId: visitDoc._id },
      { session },
    );

    // Update visit history
    if (!freshPatient.visitHistory) {
      freshPatient.visitHistory = [];
    }
    freshPatient.visitHistory.push(visitDoc._id);
    await freshPatient.save({ session });

    await session.commitTransaction();

    console.log("🎉 ========== CONSULTATION COMPLETED SUCCESSFULLY ==========");
    console.log("📋 Final Treatment Plan State:");
    if (treatmentPlan) {
      console.log(`  Plan: ${treatmentPlan.planName}`);
      console.log(`  Status: ${treatmentPlan.status}`);
      console.log(`  Stages:`);
      treatmentPlan.stages.forEach((stage, index) => {
        console.log(
          `    Stage ${index + 1}: ${stage.stageName} - ${stage.status}`,
        );
      });
    }

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      visit: visitDoc,
      treatmentPlan: treatmentPlan || null,
      planUpdated: updatedExistingPlan,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ consultPatient error:", err);
    console.error("Error stack:", err.stack);
    console.error("Full error details:", {
      name: err.name,
      message: err.message,
      code: err.code,
      keyValue: err.keyValue
    });
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
      return res.status(400).json({
        success: false,
        message: "Clinic ID and Plan Name are required",
      });
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
      { new: true },
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
    const {
      stageName,
      description,
      scheduledDate,
      toothSurfaceProcedures = [],
    } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(treatmentPlanId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid treatment plan ID",
      });
    }

    if (!stageName) {
      return res.status(400).json({
        success: false,
        message: "Stage name is required",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a completed treatment plan",
      });
    }

    // Calculate next stage number
    const nextStageNumber =
      treatmentPlan.stages.length > 0
        ? Math.max(...treatmentPlan.stages.map((s) => s.stageNumber)) + 1
        : 1;

    // Create new stage
    const newStage = {
      stageNumber: nextStageNumber,
      stageName,
      description: description || "",
      toothSurfaceProcedures: toothSurfaceProcedures.map((tsp) => ({
        toothNumber: tsp.toothNumber,
        surfaceProcedures: (tsp.surfaceProcedures || []).map((sp) => ({
          surface: sp.surface,
          procedureNames: sp.procedureNames || [],
        })),
      })),
      status: "pending",
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      notes: "",
    };

    // Add stage to treatment plan
    treatmentPlan.stages.push(newStage);
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Stage added successfully",
      stage: newStage,
      treatmentPlan,
    });
  } catch (error) {
    console.error("addStageToTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding stage",
      error: error.message,
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
        message: "Unauthorized",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a completed treatment plan",
      });
    }

    // Get the stage
    const stage = treatmentPlan.stages[stageIndex];
    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found",
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
      treatmentPlan,
    });
  } catch (error) {
    console.error("updateProcedureStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating procedure status",
      error: error.message,
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
      doctorId,
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
        message: "Unauthorized",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Treatment plan already completed",
      });
    }

    const now = new Date();

    // Complete all procedures in all teeth
    treatmentPlan.teeth.forEach((tooth) => {
      tooth.procedures.forEach((procedure) => {
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
    treatmentPlan.stages.forEach((stage) => {
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
      treatmentPlan,
    });
  } catch (error) {
    console.error("finishTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while completing treatment plan",
      error: error.message,
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
        message: "Unauthorized",
      });
    }

    if (!procedureName || !surface) {
      return res.status(400).json({
        success: false,
        message: "Procedure name and surface are required",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a completed treatment plan",
      });
    }

    // Find the tooth
    const tooth = treatmentPlan.teeth.find((t) => t.toothNumber == toothNumber);
    if (!tooth) {
      return res.status(404).json({
        success: false,
        message: `Tooth ${toothNumber} not found in treatment plan`,
      });
    }

    // Find and remove the procedure
    const procedureIndex = tooth.procedures.findIndex(
      (p) => p.name === procedureName && p.surface === surface,
    );

    if (procedureIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Procedure "${procedureName}" on surface "${surface}" not found for tooth ${toothNumber}`,
      });
    }

    const removedProcedure = tooth.procedures[procedureIndex];
    const stageNumber = removedProcedure.stage;

    // Remove the procedure
    tooth.procedures.splice(procedureIndex, 1);

    // Remove the procedure reference from the stage's toothSurfaceProcedures
    const stage = treatmentPlan.stages.find(
      (s) => s.stageNumber == stageNumber,
    );
    if (stage) {
      const toothSurface = stage.toothSurfaceProcedures.find(
        (tsp) => tsp.toothNumber == toothNumber,
      );

      if (toothSurface) {
        // Find the surface
        const surfaceProc = toothSurface.surfaceProcedures.find(
          (sp) => sp.surface === surface,
        );

        if (surfaceProc) {
          // Remove the procedure name from the array
          surfaceProc.procedureNames = surfaceProc.procedureNames.filter(
            (name) => name !== procedureName,
          );

          // If no more procedures on this surface, remove the surface entry
          if (surfaceProc.procedureNames.length === 0) {
            toothSurface.surfaceProcedures =
              toothSurface.surfaceProcedures.filter(
                (sp) => sp.surface !== surface,
              );
          }

          // If no more surfaces for this tooth, remove the tooth entry
          if (toothSurface.surfaceProcedures.length === 0) {
            stage.toothSurfaceProcedures = stage.toothSurfaceProcedures.filter(
              (tsp) => tsp.toothNumber != toothNumber,
            );
          }
        }
      }
    }

    // If tooth has no more procedures, remove the tooth
    if (tooth.procedures.length === 0) {
      treatmentPlan.teeth = treatmentPlan.teeth.filter(
        (t) => t.toothNumber != toothNumber,
      );
    }

    // Update plan costs
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: `Procedure "${procedureName}" removed from tooth ${toothNumber}`,
      treatmentPlan,
    });
  } catch (error) {
    console.error("removeProcedure error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing procedure",
      error: error.message,
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
        message: "Unauthorized",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a completed treatment plan",
      });
    }

    const stage = treatmentPlan.stages.find(
      (s) => s.stageNumber == stageNumber,
    );
    if (!stage) {
      return res.status(404).json({
        success: false,
        message: `Stage ${stageNumber} not found`,
      });
    }

    // Check if stage has any completed procedures
    const hasCompletedProcedures = treatmentPlan.teeth.some((tooth) =>
      tooth.procedures.some(
        (proc) => proc.stage == stageNumber && proc.status === "completed",
      ),
    );

    if (hasCompletedProcedures) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove stage ${stageNumber} because it has completed procedures`,
      });
    }

    // Remove procedures from this stage from all teeth
    treatmentPlan.teeth.forEach((tooth) => {
      tooth.procedures = tooth.procedures.filter(
        (proc) => proc.stage != stageNumber,
      );
    });

    // Remove empty teeth
    treatmentPlan.teeth = treatmentPlan.teeth.filter(
      (tooth) => tooth.procedures.length > 0,
    );

    // Remove the stage
    treatmentPlan.stages = treatmentPlan.stages.filter(
      (s) => s.stageNumber != stageNumber,
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
      treatmentPlan.teeth.forEach((tooth) => {
        tooth.procedures.forEach((proc) => {
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

    // CRITICAL FIX: Update overall plan status after removing stage
    treatmentPlan.updatePlanStatus();

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: `Stage ${stageNumber} removed successfully`,
      treatmentPlan,
    });
  } catch (error) {
    console.error("removeStage error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing stage",
      error: error.message,
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
        message: "Unauthorized",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    // Check if plan has any completed procedures
    const hasCompletedProcedures = treatmentPlan.teeth.some((tooth) =>
      tooth.procedures.some((proc) => proc.status === "completed"),
    );

    if (hasCompletedProcedures && treatmentPlan.status !== "draft") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete treatment plan with completed procedures. Mark as cancelled instead.",
      });
    }

    // Remove plan from patient's treatmentPlans array
    await Patient.findByIdAndUpdate(treatmentPlan.patientId, {
      $pull: { treatmentPlans: planId },
    });

    // Remove treatmentPlanId from any linked patient history
    await PatientHistory.updateMany(
      { treatmentPlanId: planId },
      { $unset: { treatmentPlanId: "" } },
    );

    // Delete the treatment plan
    await TreatmentPlan.findByIdAndDelete(planId);

    return res.status(200).json({
      success: true,
      message: "Treatment plan removed successfully",
    });
  } catch (error) {
    console.error("removeTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing treatment plan",
      error: error.message,
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
        message: "Unauthorized",
      });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res.status(404).json({
        success: false,
        message: "Treatment plan not found",
      });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed treatment plan",
      });
    }

    // Update status to cancelled
    treatmentPlan.status = "cancelled";
    treatmentPlan.cancellationReason =
      cancellationReason || "No reason provided";
    treatmentPlan.cancelledAt = new Date();
    treatmentPlan.cancelledBy = doctorId;

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Treatment plan cancelled successfully",
      treatmentPlan,
    });
  } catch (error) {
    console.error("cancelTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while cancelling treatment plan",
      error: error.message,
    });
  }
};
const getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.doctorId);

    const [appointments, completedCount, revenueStats] = await Promise.all([
      // ✅ all appointments list
      Appointment.find({ doctorId }).sort({ appointmentDate: -1 }),

      // ✅ completed appointments count
      Appointment.countDocuments({
        doctorId,
        status: "completed",
      }),

      // ✅ revenue + patient stats
      PatientHistory.aggregate([
        {
          $match: {
            doctorId,
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$consultationFee" },
            uniquePatients: { $addToSet: "$patientId" },
            totalVisits: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            totalRevenue: 1,
            totalVisits: 1,
            totalPatients: { $size: "$uniquePatients" },
          },
        },
      ]),
    ]);

    const stats = revenueStats[0] || {
      totalRevenue: 0,
      totalPatients: 0,
      totalVisits: 0,
    };

    res.json({
      totalAppointments: appointments.length,
      completedAppointments: completedCount, // 🔥 NEW
      totalRevenue: stats.totalRevenue,
      totalPatients: stats.totalPatients,
      totalVisits: stats.totalVisits,
      appointments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getWeeklyStats = async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.doctorId);

    // 📅 last 7 days range
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 6);

    const start = startDate.toISOString().split("T")[0];
    const end = today.toISOString().split("T")[0];

    const stats = await Appointment.aggregate([
      {
        $match: {
          doctorId,
          appointmentDate: { $gte: start, $lte: end }, // string compare works
        },
      },
      {
        $group: {
          _id: "$appointmentDate",
          appointments: { $sum: 1 },
          patients: { $addToSet: "$patientId" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          appointments: 1,
          patients: { $size: "$patients" },
        },
      },
    ]);

    // 🔥 fill missing days with 0 (important for charts)
    const map = {};
    stats.forEach((s) => {
      map[s.date] = s;
    });

    const result = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const key = d.toISOString().split("T")[0];

      result.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        appointments: map[key]?.appointments || 0,
        patients: map[key]?.patients || 0,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getDoctorAnalytics = async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.doctorId);

    const today = new Date();

    /* =================================================
       📅 DATE CALCULATIONS
    ================================================= */

    // weekly (last 7 days)
    const weekStart = new Date();
    weekStart.setDate(today.getDate() - 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    // monthly (last 4 months)
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(today.getMonth() - 3);

    /* =================================================
       ⚡ RUN EVERYTHING IN PARALLEL (FAST)
    ================================================= */

    const [
      totalAppointments,
      completedAppointments,
      revenueStats,
      weeklyStatsRaw,
      monthlyRevenueRaw,
    ] = await Promise.all([
      /* ======================
         TOTAL APPOINTMENTS
      ====================== */
      Appointment.countDocuments({ doctorId }),

      /* ======================
         COMPLETED APPOINTMENTS
      ====================== */
      Appointment.countDocuments({
        doctorId,
        status: "completed",
      }),

      /* ======================
         REVENUE + PATIENTS + VISITS
      ====================== */
      PatientHistory.aggregate([
        {
          $match: {
            doctorId,
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$consultationFee" },
            uniquePatients: { $addToSet: "$patientId" },
            totalVisits: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            totalRevenue: 1,
            totalVisits: 1,
            totalPatients: { $size: "$uniquePatients" },
          },
        },
      ]),

      /* ======================
         WEEKLY STATS
      ====================== */
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            appointmentDate: {
              $gte: weekStartStr,
              $lte: todayStr,
            },
          },
        },
        {
          $group: {
            _id: "$appointmentDate",
            appointments: { $sum: 1 },
            patients: { $addToSet: "$patientId" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            appointments: 1,
            patients: { $size: "$patients" },
          },
        },
      ]),

      /* ======================
         MONTHLY REVENUE (last 4 months only)
      ====================== */
      PatientHistory.aggregate([
        {
          $match: {
            doctorId,
            status: "completed",
            visitDate: { $gte: fourMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$visitDate" },
              month: { $month: "$visitDate" },
            },
            revenue: { $sum: "$consultationFee" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]),
    ]);

    /* =================================================
       📊 FORMAT WEEKLY (always 7 days)
    ================================================= */

    const weeklyMap = {};
    weeklyStatsRaw.forEach((w) => (weeklyMap[w.date] = w));

    const weeklyStats = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);

      const key = d.toISOString().split("T")[0];

      weeklyStats.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        appointments: weeklyMap[key]?.appointments || 0,
        patients: weeklyMap[key]?.patients || 0,
      });
    }

    /* =================================================
       📈 FORMAT MONTHLY (always last 4 months)
    ================================================= */

    const monthlyMap = {};

    monthlyRevenueRaw.forEach((m) => {
      const key = `${m._id.year}-${m._id.month}`; // use raw numbers only
      monthlyMap[key] = m.revenue;
    });

    const monthlyRevenue = [];

    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setMonth(today.getMonth() - i);

      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      const key = `${year}-${month}`;

      monthlyRevenue.push({
        month: d.toLocaleString("en-US", { month: "short" }),
        revenue: monthlyMap[key] || 0,
      });
    }

    /* =================================================
       📦 FINAL DATA
    ================================================= */

    const revenueData = revenueStats[0] || {
      totalRevenue: 0,
      totalPatients: 0,
      totalVisits: 0,
    };

    res.json({
      cards: {
        totalAppointments,
        completedAppointments,
        totalRevenue: revenueData.totalRevenue,
        totalPatients: revenueData.totalPatients,
        totalVisits: revenueData.totalVisits,
      },
      weeklyStats,
      monthlyRevenue,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getCurrentMonthRevenue = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const now = new Date();

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await PatientHistory.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          isPaid: true, // only paid bills
          status: "completed",
          createdAt: {   // 🔥 use billing date
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalPatients: { $sum: 1 },
        },
      },
    ]);

    res.json({
      totalRevenue: result[0]?.totalRevenue || 0,
      totalPatients: result[0]?.totalPatients || 0,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};
const getAllConsultedPatients = async (req, res) => {
  const { id } = req.params;
  const { cursorDate, cursorId, limit = 10 } = req.query; 
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid Doctor ID format" 
    });
  }

  const doctorId = new mongoose.Types.ObjectId(id);
  const pageLimit = parseInt(limit) > 50 ? 50 : parseInt(limit);

  try {
    // Build the initial match condition
    const matchCondition = { doctorId: doctorId };
    
    // Add cursor condition if cursor exists
    if (cursorDate && cursorId) {
      matchCondition.$or = [
        { 
          visitDate: { $lt: new Date(cursorDate) }
        },
        {
          visitDate: new Date(cursorDate),
          _id: { $lt: new mongoose.Types.ObjectId(cursorId) }
        }
      ];
    }

    // First, get the aggregated data without clinic details
    const data = await PatientHistory.aggregate([
      {
        $match: matchCondition
      },
      { $sort: { visitDate: -1, _id: -1 } },
      {
        $group: {
          _id: "$patientId",  // Group by patientId only
          lastVisitDate: { $first: "$visitDate" },
          lastVisitId: { $first: "$_id" },
          clinicId: { $first: "$clinicId" },
        },
      },
      { $sort: { lastVisitDate: -1, lastVisitId: -1 } },
      { $limit: pageLimit },
      {
        $lookup: {
          from: "patients",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      { 
        $unwind: {
          path: "$patient",
          preserveNullAndEmptyArrays: true 
        } 
      },
      {
        $project: {
          _id: 0,
          patientId: "$_id",
          patientName: "$patient.name",
          clinicId: 1,
          lastVisitDate: 1,
          lastVisitId: 1,
        },
      },
    ]);

    // Get total unique patients count (not total visits)
    const totalPatientsResult = await PatientHistory.aggregate([
      {
        $match: { doctorId: doctorId }
      },
      {
        $group: {
          _id: "$patientId"  // Group by patientId to get unique patients
        }
      },
      {
        $count: "totalPatients"
      }
    ]);

    const totalPatients = totalPatientsResult[0]?.totalPatients || 0;

    if (totalPatients === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "No patient history found for this doctor",
        nextCursor: null,
        hasNextPage: false,
        totalPatients: 0
      });
    }

    // Get clinic details only if we have data
    if (data.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        nextCursor: null,
        hasNextPage: false,
        totalPatients
      });
    }

    const clinicIds = [...new Set(data.map(item => item.clinicId?.toString()).filter(Boolean))];
    const clinicMap = new Map();
    const clinicPromises = clinicIds.map(async (clinicId) => {
      try {
        const response = await axios.get(
          `${authBaseUrl}/api/v1/auth/clinic/view-clinic/${clinicId}`,
          { timeout: 5000 } 
        );
        
        if (response.data.success && response.data.data) {
          clinicMap.set(clinicId, {
            name: response.data.data.name,
            email: response.data.data.email,
            phoneNumber: response.data.data.phoneNumber
          });
        }
      } catch (error) {
        console.error(`Failed to fetch clinic ${clinicId}:`, error.message);
        clinicMap.set(clinicId, {
          name: 'Unknown Clinic',
          email: '',
          phoneNumber: ''
        });
      }
    });

    // Wait for all clinic fetches to complete
    await Promise.all(clinicPromises);

    // Enrich the data with clinic details
    const enrichedData = data.map(item => ({
      patientId: item.patientId,
      patientName: item.patientName,
      clinicId: item.clinicId,
      clinicName: item.clinicId ? (clinicMap.get(item.clinicId.toString())?.name || 'Unknown Clinic') : 'No Clinic',
      clinicEmail: item.clinicId ? (clinicMap.get(item.clinicId.toString())?.email || '') : '',
      clinicPhone: item.clinicId ? (clinicMap.get(item.clinicId.toString())?.phoneNumber || '') : '',
      lastVisitDate: item.lastVisitDate,
      recordType: "Patient Record"
    }));

    // Check if there are more unique patients after our current batch
    let hasNextPage = false;
    const lastItem = data[data.length - 1];
    
    if (data.length === pageLimit) {
      // Check if there are more unique patients
      const nextPatientsCheck = await PatientHistory.aggregate([
        {
          $match: {
            doctorId: doctorId,
            $or: [
              { 
                visitDate: { $lt: lastItem.lastVisitDate }
              },
              {
                visitDate: lastItem.lastVisitDate,
                _id: { $lt: new mongoose.Types.ObjectId(lastItem.lastVisitId) }
              }
            ]
          }
        },
        {
          $group: {
            _id: "$patientId"  // Check for more unique patients
          }
        },
        { $limit: 1 }
      ]);

      hasNextPage = nextPatientsCheck.length > 0;
    }

    // Prepare next cursor
    const nextCursor = hasNextPage ? {
      visitDate: lastItem.lastVisitDate,
      _id: lastItem.lastVisitId
    } : null;

    return res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData,
      nextCursor,
      hasNextPage,
      totalPatients,  // Return total unique patients
      currentPageCount: enrichedData.length
    });
  } catch (error) {
    console.error("❌ getAllConsultedPatients error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch consulted patients",
      error: error.message
    });
  }
};

export {
  consultPatient,
  startTreatmentPlan,
  addStageToTreatmentPlan,
  updateProcedureStatus,
  completeStage,
  finishTreatmentPlan,
  removeProcedure,
  removeStage,
  removeTreatmentPlan,
  cancelTreatmentPlan,
  getDoctorDashboard,
  getWeeklyStats,
  getDoctorAnalytics,
  getCurrentMonthRevenue,
  getAllConsultedPatients
};

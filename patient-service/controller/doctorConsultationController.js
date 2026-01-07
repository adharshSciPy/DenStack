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
    const performedTeeth = parseJSON(req.body.performedTeeth, []); // 🔴 FIX
    const treatmentPlanInput = parseJSON(req.body.treatmentPlan, null);
    const recall = parseJSON(req.body.recall, null);
    const notes = req.body.notes || "";

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

    // ---------- 🔴 FIXED: CREATE VISIT (MATCHES SCHEMA) ----------
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
        status: p.status || "planned",
        cost: p.cost,
        notes: p.notes,
        performedBy: doctorId,
        performedAt: new Date(),
        treatmentPlanProcedureId: p.treatmentPlanProcedureId
      }))
    }));

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

    // ---------- treatment plan ----------
    let treatmentPlan = null;

    if (req.body.treatmentPlanId) {
      treatmentPlan = await TreatmentPlan.findById(req.body.treatmentPlanId).session(session);
    }

    if (!treatmentPlan && treatmentPlanInput?.planName) {
      [treatmentPlan] = await TreatmentPlan.create(
        [{
          patientId: appointment.patientId,
          clinicId: appointment.clinicId,
          createdByDoctorId: doctorId,
          planName: treatmentPlanInput.planName,
          description: treatmentPlanInput.description,
          teeth: [],
          stages: []
        }],
        { session }
      );

      patient.treatmentPlans.push(treatmentPlan._id);
    }

    // ---------- planned procedures (UNCHANGED LOGIC) ----------
    if (treatmentPlan && plannedProcedures.length) {
      for (const p of plannedProcedures) {
        let tooth = treatmentPlan.teeth.find(t => t.toothNumber === p.toothNumber);

        if (!tooth) {
          tooth = { toothNumber: p.toothNumber, procedures: [] };
          treatmentPlan.teeth.push(tooth);
        }

        tooth.procedures.push({
          _id: new mongoose.Types.ObjectId(),
          name: p.name,
          surface: p.surface,
          estimatedCost: p.estimatedCost || 0,
          notes: p.notes,
          status: "planned"
        });
      }
    }

    // ---------- 🔴 FIXED: completed procedures (ID SAFE) ----------
    if (treatmentPlan && dentalWork.length) {
      for (const t of dentalWork) {
        const planTooth = treatmentPlan.teeth.find(pt => pt.toothNumber === t.toothNumber);
        if (!planTooth) continue;

        for (const proc of t.procedures.filter(p => p.status === "completed")) {
          const planProc = planTooth.procedures.find(
            pp => pp.name === proc.name && pp.surface === proc.surface && pp.status !== "completed"
          );

          if (!planProc) continue;

          planProc.status = "completed";
          planProc.completedAt = new Date();
          planProc.completedInVisitId = visitDoc._id;

          proc.treatmentPlanProcedureId = planProc._id;
        }
      }
    }

    if (treatmentPlan) {
      await treatmentPlan.save({ session });
      visitDoc.treatmentPlanId = treatmentPlan._id;
      await visitDoc.save({ session });
    }

    // ---------- recall (UNCHANGED) ----------
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
    }

    // ---------- finalize (UNCHANGED) ----------
    await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: "completed", visitId: visitDoc._id },
      { session }
    );

    patient.visitHistory.push(visitDoc._id);
    await patient.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      visit: visitDoc,
      treatmentPlan
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("consultPatient error:", err);
    return res.status(500).json({
      success: false,
      message: "Consultation failed",
      error: err.message
    });
  } finally {
    session.endSession();
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
    const { stageName, description = "", procedures = [], scheduledDate } = req.body;

    const doctorId = req.doctorId; // from authDoctor middleware
    if (!doctorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!stageName) {
      return res.status(400).json({ success: false, message: "Stage name is required" });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({ success: false, message: "Treatment plan not found" });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot add stage to a completed treatment plan",
      });
    }

    const newStage = {
      stageName,
      description,
      procedures: procedures.map((p) => ({
        name: p.name,
        doctorId: p.doctorId || doctorId, // assign doctor
        referredByDoctorId: doctorId,
        referredToDoctorId: p.doctorId || doctorId,
        referralNotes: p.referralNotes || "",
        completed: false,
      })),
      scheduledDate: scheduledDate || new Date().toISOString(),
      status: "pending",
    };

    treatmentPlan.stages.push(newStage);
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "New stage added successfully",
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
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (typeof completed !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "Completed status must be boolean" });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) {
      return res
        .status(404)
        .json({ success: false, message: "Treatment plan not found" });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot update procedure in a completed plan",
      });
    }

    const stage = treatmentPlan.stages[stageIndex];
    if (!stage) {
      return res.status(404).json({ success: false, message: "Stage not found" });
    }

    // If procedures array is empty, create a default procedure
    if (!stage.procedures || stage.procedures.length === 0) {
      stage.procedures = [
        {
          name: "Default Procedure",
          doctorId,
          referredByDoctorId: doctorId,
          referredToDoctorId: doctorId,
          referralNotes: "",
          completed: false,
        },
      ];
    }

    const procedure = stage.procedures[procedureIndex];
    if (!procedure) {
      return res
        .status(404)
        .json({ success: false, message: "Procedure not found" });
    }

    procedure.completed = completed;

    // Mark stage completed if all procedures are done
    if (stage.procedures.every((p) => p.completed)) {
      stage.status = "completed";
    }

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Procedure status updated",
      treatmentPlan,
    });
  } catch (error) {
    console.error("updateProcedureStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating procedure",
      error: error.message,
    });
  }
};


const finishTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({ success: false, message: "Treatment plan not found" });
    }

    treatmentPlan.status = "completed";
    treatmentPlan.completedAt = new Date();
    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Treatment plan marked as completed",
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



export{ consultPatient , startTreatmentPlan,addStageToTreatmentPlan,updateProcedureStatus,finishTreatmentPlan};
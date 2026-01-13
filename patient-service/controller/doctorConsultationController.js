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

    // ---------- TREATMENT PLAN CREATION (FIXED) ----------

let treatmentPlan = null;

if (treatmentPlanInput?.planName) {
  console.log("Creating treatment plan:", treatmentPlanInput);
  
  // Transform teeth data for schema - USE treatmentPlanInput.teeth instead of plannedProcedures
  const teethData = treatmentPlanInput.teeth.map(toothPlan => ({
    toothNumber: toothPlan.toothNumber,
    procedures: toothPlan.procedures.map(proc => ({
      _id: new mongoose.Types.ObjectId(),
      name: proc.name,
      surface: proc.surface || "occlusal",
      estimatedCost: proc.estimatedCost || 0,
      notes: proc.notes || "",
      status: proc.status || "planned"
    })),
    priority: toothPlan.priority || 'medium',
    isCompleted: false
  }));

  // Transform stages for schema
  const stagesData = (treatmentPlanInput.stages || []).map(stage => ({
    stageName: stage.stageName || `Stage ${Date.now()}`,
    description: stage.description || '',
    procedureRefs: stage.procedureRefs || [],
    status: stage.status || 'pending',
    scheduledDate: stage.scheduledDate ? new Date(stage.scheduledDate) : new Date()
  }));

  // If no stages provided, create a default stage
  if (stagesData.length === 0 && teethData.length > 0) {
    stagesData.push({
      stageName: "Initial Treatment",
      description: "Primary procedures",
      procedureRefs: teethData.flatMap(tooth => 
        tooth.procedures.map(proc => ({
          toothNumber: tooth.toothNumber,
          procedureName: proc.name
        }))
      ),
      status: 'pending',
      scheduledDate: new Date()
    });
  }

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
      status: "ongoing",
      startedAt: new Date()
    }],
    { session }
  );

  console.log("Treatment plan created with teeth:", treatmentPlan.teeth);
  console.log("Treatment plan created with stages:", treatmentPlan.stages);

  // Link to patient
  if (!patient.treatmentPlans) {
    patient.treatmentPlans = [];
  }
  patient.treatmentPlans.push(treatmentPlan._id);
  await patient.save({ session });
}

    // ---------- link visit to treatment plan ----------
    if (treatmentPlan) {
      visitDoc.treatmentPlanId = treatmentPlan._id;
      await visitDoc.save({ session });
      
      console.log("Visit linked to treatment plan:", treatmentPlan._id);
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

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      visit: visitDoc,
      treatmentPlan: treatmentPlan || null
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("consultPatient error:", err);
    return res.status(500).json({
      success: false,
      message: "Consultation failed",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
//when adding the stage its actually adding to teeth array instead of stages in DB..
const addStageToTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;
    const { teeth = [] } = req.body;
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

    if (!Array.isArray(teeth) || teeth.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Teeth array is required"
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

    // ---------- normalize teeth ----------
    const teethToInsert = teeth.map(tooth => ({
      toothNumber: tooth.toothNumber,
      priority: tooth.priority || "medium",
      isCompleted: false,
      procedures: (tooth.procedures || []).map(proc => ({
        _id: new mongoose.Types.ObjectId(),
        name: proc.name,
        surface: proc.surface || "occlusal",
        estimatedCost: proc.estimatedCost || 0,
        notes: proc.notes || "",
        status: proc.status || "planned",
        createdByDoctorId: doctorId
      }))
    }));

    // ---------- PUSH INTO TEETH ARRAY ----------
    await TreatmentPlan.findByIdAndUpdate(
      treatmentPlanId,
      {
        $push: {
          teeth: { $each: teethToInsert }
        }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Teeth added successfully to treatment plan"
    });

  } catch (error) {
    console.error("addTeethToTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding teeth",
      error: error.message
    });
  }
};

const updateProcedureStatus = async (req, res) => {
  try {
    const { id: planId, toothIndex } = req.params;
    const { isCompleted } = req.body;
    const doctorId = req.doctorId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (typeof isCompleted !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isCompleted must be boolean"
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

    const tooth = treatmentPlan.teeth[toothIndex];
    if (!tooth) {
      return res.status(404).json({
        success: false,
        message: "Tooth not found"
      });
    }

    // ---------- UPDATE TOOTH ----------
    tooth.isCompleted = isCompleted;

    // ---------- OPTIONAL: SYNC PROCEDURES ----------
    // (keep procedures consistent with tooth state)
    if (Array.isArray(tooth.procedures)) {
      tooth.procedures.forEach(proc => {
        proc.isCompleted = isCompleted;
      });
    }

    // ---------- UPDATE PLAN STATUS ----------
    treatmentPlan.status = treatmentPlan.teeth.every(t => t.isCompleted)
      ? "completed"
      : "ongoing";

    await treatmentPlan.save();

    return res.status(200).json({
      success: true,
      message: "Tooth status updated successfully",
      treatmentPlan
    });

  } catch (error) {
    console.error("updateProcedureStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating tooth status",
      error: error.message
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

    // ---------- FORCE COMPLETE ALL TEETH ----------
    treatmentPlan.teeth.forEach(tooth => {
      if (!tooth.isCompleted) {
        tooth.isCompleted = true;
        tooth.completedAt = now;
      }

      // ---------- FORCE COMPLETE PROCEDURES ----------
      if (Array.isArray(tooth.procedures)) {
        tooth.procedures.forEach(proc => {
          if (proc.status !== "completed") {
            proc.status = "completed";
            proc.completedAt = now;
          }
        });
      }
    });

    // ---------- COMPLETE PLAN ----------
    treatmentPlan.status = "completed";
    treatmentPlan.completedAt = now;

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




export{ consultPatient , startTreatmentPlan,addStageToTreatmentPlan,updateProcedureStatus,finishTreatmentPlan};
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

  try {
    const { id: appointmentId } = req.params;
    const doctorId = req.doctorClinic?.doctorId;
    const { symptoms, diagnosis, prescriptions, notes, files = [], procedures = [], treatmentPlan } = req.body;

    // Basic validations
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }
    if (!doctorId) {
      return res.status(403).json({ success: false, message: "Unauthorized: Missing doctor context" });
    }

    // Fetch appointment and check doctor
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    if (appointment.doctorId?.toString() !== doctorId?.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: Doctor mismatch" });
    }

    // Fetch patient
    const patient = await Patient.findById(appointment.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Fetch consultation fee (best-effort) — fallback to 0 on error
    let consultationFee = 0;
    try {
      const doctorsResp = await axios.get(`${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${appointment.clinicId}`);
      const doctorData = doctorsResp.data?.doctors?.find(d => d.doctorId?.toString() === doctorId.toString());
      consultationFee = doctorData?.standardConsultationFee ?? 0;
    } catch (err) {
      console.error("Error fetching doctor fee:", err.message);
      consultationFee = 0;
    }

    // Start transaction
    session.startTransaction();

    // Create PatientHistory (visit)
    const newVisit = new PatientHistory({
      patientId: appointment.patientId,
      clinicId: appointment.clinicId,
      doctorId,
      appointmentId,
      symptoms: Array.isArray(symptoms) ? symptoms : (symptoms ? [symptoms] : []),
      diagnosis: Array.isArray(diagnosis) ? diagnosis : (diagnosis ? [diagnosis] : []),
      prescriptions: prescriptions || [],
      notes: notes || "",
      files: files || [],
      procedures: procedures || [],
      consultationFee,
      createdBy: doctorId,
    });

    await newVisit.save({ session });

    // Optionally create TreatmentPlan and link it
    let newPlan = null;
    if (treatmentPlan && treatmentPlan.planName) {
      // validate and prepare stages & procedures
      const preparedStages = (treatmentPlan.stages || []).map((s) => ({
        stageName: s.stageName,
        description: s.description,
        scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : undefined,
        status: "pending",
        procedures: (s.procedures || []).map((p) => ({
          name: p.name,
          doctorId: p.doctorId || doctorId,
          referredByDoctorId: doctorId,
          referredToDoctorId: p.doctorId || doctorId,
          referralNotes: p.referralNotes || "",
          completed: false,
        })),
      }));

      newPlan = new TreatmentPlan({
        patientId: appointment.patientId,
        clinicId: appointment.clinicId,
        createdByDoctorId: doctorId,
        planName: treatmentPlan.planName,
        description: treatmentPlan.description || "",
        stages: preparedStages,
        status: "ongoing",
      });

      await newPlan.save({ session });

      // Link plan id to the visit
      newVisit.treatmentPlanId = newPlan._id;
      await newVisit.save({ session });

      // Also add to patient's treatmentPlans array
      patient.treatmentPlans = patient.treatmentPlans || [];
      patient.treatmentPlans.push(newPlan._id);
    }

    // Update appointment to completed + attach visitId
    appointment.status = "completed";
    appointment.visitId = newVisit._id;
    await appointment.save({ session });

    // Link visit to patient history array
    patient.visitHistory = patient.visitHistory || [];
    patient.visitHistory.push(newVisit._id);
    await patient.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // End session
    session.endSession();

    // Return response
    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      patientHistoryId: newVisit._id,
      visit: newVisit,
      treatmentPlan: newPlan || null,
    });
  } catch (error) {
    // Abort transaction on error
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      console.error("Error aborting transaction:", abortErr);
    }
    session.endSession();

    console.error("consultPatient error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during consultation",
      error: error.message,
    });
  }
};
const startTreatmentPlan = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const doctorId = req.doctorClinic?.doctorId;
    const clinicId = req.doctorClinic?.clinicId;
    const { planName, description, stages = [] } = req.body;

    if (!doctorId || !clinicId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Missing clinic or doctor context",
      });
    }

 
    if (!planName) {
      return res.status(400).json({ success: false, message: "Plan name is required" });
    }

  
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    
    if (patient.clinicId.toString() !== clinicId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Patient does not belong to this clinic",
      });
    }

    // ✅ Prepare stages with defaults
    const preparedStages = stages.map((s) => ({
      stageName: s.stageName,
      description: s.description,
      scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : undefined,
      status: "pending", 
      procedures: s.procedures?.map((p) => ({
        name: p.name,
        doctorId: p.doctorId || doctorId, 
        referredByDoctorId: doctorId,
        referredToDoctorId: p.doctorId,
        referralNotes: p.referralNotes || "",
        completed: false, 
      })) || [],
    }));

    // ✅ Create new treatment plan
    const newPlan = new TreatmentPlan({
      patientId,
      clinicId,
      createdByDoctorId: doctorId, 
      planName,
      description,
      stages: preparedStages,
      status: "ongoing",
    });

    await newPlan.save();

    // ✅ Link to patient
    patient.treatmentPlans = patient.treatmentPlans || [];
    patient.treatmentPlans.push(newPlan._id);
    await patient.save();

    return res.status(201).json({
      success: true,
      message: stages.length
        ? "Treatment plan started successfully with stages"
        : "Treatment plan started successfully (no stages yet)",
      treatmentPlan: newPlan,
    });
  } catch (err) {
    console.error("startTreatmentPlan error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while starting treatment plan",
      error: err.message,
    });
  }
};

const addStageToTreatmentPlan = async (req, res) => {
  try {
    const { id: treatmentPlanId } = req.params;
    const { stageName, description, procedures = [], scheduledDate } = req.body;

    if (!stageName) {
      return res.status(400).json({ success: false, message: "Stage name is required" });
    }

    const treatmentPlan = await TreatmentPlan.findById(treatmentPlanId);
    if (!treatmentPlan) {
      return res.status(404).json({ success: false, message: "Treatment plan not found" });
    }

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot add stage to a completed treatment plan" });
    }

    const newStage = {
      stageName,
      description,
      procedures: procedures.map((p) => ({
        name: p.name,
        doctorId: p.doctorId || treatmentPlan.createdByDoctorId,
        referredByDoctorId: treatmentPlan.createdByDoctorId,
        referredToDoctorId: p.doctorId || treatmentPlan.createdByDoctorId,
        referralNotes: p.referralNotes || "",
        completed: false,
      })),
      scheduledDate,
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
    const { id:planId, stageIndex, procedureIndex } = req.params;
    const { completed } = req.body; 

    if (typeof completed !== "boolean") {
      return res.status(400).json({ success: false, message: "Completed status must be boolean" });
    }

    const treatmentPlan = await TreatmentPlan.findById(planId);
    if (!treatmentPlan) return res.status(404).json({ success: false, message: "Treatment plan not found" });

    if (treatmentPlan.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot update procedure in a completed plan" });
    }

    const stage = treatmentPlan.stages[stageIndex];
    if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });

    const procedure = stage.procedures[procedureIndex];
    if (!procedure) return res.status(404).json({ success: false, message: "Procedure not found" });

    procedure.completed = completed;

    // Optional: mark stage completed if all procedures are done
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
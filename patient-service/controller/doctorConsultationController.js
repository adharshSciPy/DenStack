import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import Patient from "../model/patientSchema.js";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

const consultPatient = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
    const doctorId = req.doctorClinic?.doctorId;

    const { symptoms, diagnosis, prescriptions, notes, files = [], procedures = [] } = req.body;

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (appointment.doctorId?.toString() !== doctorId?.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: Doctor mismatch" });
    }

    const patient = await Patient.findById(appointment.patientId);
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    // 🔹 Fetch standard consultation fee from Clinic Service
    let consultationFee = 0;
    try {
      const doctorsResp = await axios.get(`${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${appointment.clinicId}`);
      const doctorData = doctorsResp.data?.doctors?.find(d => d.doctorId.toString() === doctorId.toString());
      consultationFee = doctorData?.standardConsultationFee ?? 0; // fallback to 0
    } catch (err) {
      console.error("Error fetching doctor fee:", err.message);
      consultationFee = 0;
    }

    // 🔹 Create new patient history with consultation fee and procedures
    const newVisit = new PatientHistory({
      patientId: appointment.patientId,
      clinicId: appointment.clinicId,
      doctorId,
      appointmentId,
      symptoms,
      diagnosis,
      prescriptions,
      notes,
      files,
      procedures,
      consultationFee,
      createdBy: doctorId,
    });

    // 🔹 Save visit (pre-save hook calculates totalAmount)
    await newVisit.save();

    // 🔹 Update appointment
    appointment.status = "completed";
    appointment.visitId = newVisit._id;
    await appointment.save();

    // 🔹 Update patient visit history
    patient.visitHistory = patient.visitHistory || [];
    patient.visitHistory.push(newVisit._id);
    await patient.save();

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
      patientHistoryId: newVisit._id,
      visit: newVisit,
    });

  } catch (error) {
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
    const { id:patientId } = req.params;
    const doctorId = req.doctorClinic?.doctorId;
    const clinicId = req.doctorClinic?.clinicId;
    const { planName, description, stages = [] } = req.body;

    // ✅ Validate required fields
    if (!doctorId || !clinicId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Doctor or clinic not found in request context",
      });
    }

    if (!planName) {
      return res.status(400).json({ success: false, message: "Plan name is required" });
    }

    // ✅ Validate patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // ✅ Ensure patient belongs to the same clinic
    if (patient.clinicId.toString() !== clinicId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Patient does not belong to this clinic",
      });
    }

    // ✅ Create treatment plan
    const newPlan = new TreatmentPlan({
      patientId,
      clinicId,
      doctorId,
      planName,
      description,
      stages,
    });

    await newPlan.save();

    // ✅ Link treatment plan to patient
    if (!Array.isArray(patient.treatmentPlans)) patient.treatmentPlans = [];
    patient.treatmentPlans.push(newPlan._id);
    await patient.save();

    return res.status(201).json({
      success: true,
      message: "Treatment plan started successfully",
      treatmentPlan: newPlan,
    });
  } catch (error) {
    console.error("startTreatmentPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while starting treatment plan",
      error: error.message,
    });
  }
};

export{ consultPatient , startTreatmentPlan};
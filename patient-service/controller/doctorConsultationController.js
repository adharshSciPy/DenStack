import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import Patient from "../model/patientSchema.js";
import mongoose from "mongoose";
const consultPatient = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
   const doctorId = req.doctorClinic?.doctorId;

    const { symptoms, diagnosis, prescriptions, notes, referrals = [], files = [] } = req.body;

    // 1️⃣ Validate appointment
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
console.log("appointment.doctorId:", appointment.doctorId);
console.log("req.user.id:", doctorId);
console.log("Comparison:", appointment.doctorId?.toString() === doctorId?.toString());

    // 2️⃣ Ensure logged-in doctor matches appointment doctor
    if (appointment.doctorId && appointment.doctorId.toString() !== doctorId?.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: Doctor mismatch" });
    }

    // 3️⃣ Ensure patient exists
    const patient = await Patient.findById(appointment.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // 4️⃣ Create new visit record
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
      referrals,
      createdBy: doctorId,
    });

    await newVisit.save();

    // 5️⃣ Link visit to appointment
    appointment.status = "completed";
    appointment.visitId = newVisit._id;
    await appointment.save();

    // 6️⃣ Add visit to patient history
    patient.visitHistory = patient.visitHistory || [];
    patient.visitHistory.push(newVisit._id);
    await patient.save();

    return res.status(201).json({
      success: true,
      message: "Consultation saved successfully",
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
export{ consultPatient };
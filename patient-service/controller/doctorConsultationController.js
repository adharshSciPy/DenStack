import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import Patient from "../model/patientSchema.js";
import mongoose from "mongoose";
const consultPatient = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
   const doctorId = req.doctorClinic?.doctorId;

    const { symptoms, diagnosis, prescriptions, notes,  files = [] } = req.body;

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    if (appointment.doctorId && appointment.doctorId.toString() !== doctorId?.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: Doctor mismatch" });
    }

    
    const patient = await Patient.findById(appointment.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }
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
      createdBy: doctorId,
    });

    await newVisit.save();


    appointment.status = "completed";
    appointment.visitId = newVisit._id;
    await appointment.save();

   
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
export{ consultPatient };
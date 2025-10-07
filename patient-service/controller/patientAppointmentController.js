import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import axios from "axios";
import Patient from "../model/patientSchema.js";
import Appointment from "../model/appointmentSchema.js";

configDotenv();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;

const createAppointment = async (req, res) => {
  const { id: clinicId } = req.params;
  const { receptionistId, patientId, doctorId, appointmentDate, appointmentTime } = req.body;

  try {
    // 1️⃣ Validate all required fields
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId))
      return res.status(400).json({ success: false, message: "Invalid patientId" });
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: "Invalid doctorId" });
    if (!receptionistId || !mongoose.Types.ObjectId.isValid(receptionistId))
      return res.status(400).json({ success: false, message: "Invalid receptionistId" });
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate))
      return res.status(400).json({ success: false, message: "Invalid appointmentDate (use YYYY-MM-DD)" });
    if (!appointmentTime || !/^\d{2}:\d{2}$/.test(appointmentTime))
      return res.status(400).json({ success: false, message: "Invalid appointmentTime (use HH:mm)" });

    // 2️⃣ Combine date and time into a Date object
    const [hour, minute] = appointmentTime.split(":").map(Number);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
      return res.status(400).json({ success: false, message: "Invalid time values" });

    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
    const now = new Date();
    if (appointmentDateTime.getTime() <= now.getTime())
      return res.status(400).json({ success: false, message: "Cannot book appointment in the past" });

    // 3️⃣ Verify patient exists
    const patient = await Patient.findOne({ _id: patientId, clinicId });
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found in this clinic" });

    // 4️⃣ Verify receptionist belongs to clinic
    let isReceptionistInClinic = false;
    try {
      const staffRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic/all-staffs/${clinicId}`);
      const clinic = staffRes.data?.clinic;
      if (!clinic || !clinic.staffs)
        return res.status(404).json({ success: false, message: "Clinic or staff data not found" });

      isReceptionistInClinic = clinic.staffs.receptionists.some(
        (rec) => rec._id.toString() === receptionistId.toString()
      );
      if (!isReceptionistInClinic)
        return res.status(403).json({ success: false, message: "Receptionist does not belong to this clinic" });
    } catch (err) {
      // External service failed, but server continues running
      return res.status(503).json({
        success: false,
        message: "Cannot verify receptionist at this time. Try again later.",
        error: err.message
      });
    }

    // 5️⃣ Fetch doctor availability
    let availabilities = [];
    try {
      const availRes = await axios.get(`${CLINIC_SERVICE_BASE_URL}/department-based/availability`, {
        params: { doctorId, clinicId },
      });
      availabilities = availRes.data?.doctors?.[0]?.availability || [];
      if (!availabilities.length)
        return res.status(400).json({ success: false, message: "Doctor has no availability in this clinic" });
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: "Cannot fetch doctor availability at this time. Try again later.",
        error: err.message
      });
    }

    // 6️⃣ Check if appointment falls within available slots
    const appointmentDay = new Date(appointmentDate).toLocaleString("en-US", { weekday: "long" });
    const appointmentMinutes = hour * 60 + minute;
    const isAvailable = availabilities.some((slot) => {
      if (slot.clinicId.toString() !== clinicId.toString() || slot.dayOfWeek !== appointmentDay) return false;
      const [startH, startM] = slot.startTime.split(":").map(Number);
      const [endH, endM] = slot.endTime.split(":").map(Number);
      const slotStart = startH * 60 + startM;
      const slotEnd = endH * 60 + endM;
      return appointmentMinutes >= slotStart && appointmentMinutes < slotEnd;
    });
    if (!isAvailable)
      return res.status(400).json({
        success: false,
        message: `Doctor is not available on ${appointmentDay} at ${appointmentTime}`,
      });

    // 7️⃣ Prevent double booking
    const existingAppointment = await Appointment.findOne({
      doctorId,
      clinicId,
      appointmentDate,
      appointmentTime,
      status: "scheduled",
    });
    if (existingAppointment)
      return res.status(400).json({ success: false, message: "Doctor already has an appointment at this time" });

    // 8️⃣ Calculate daily OP number
    const lastAppointmentToday = await Appointment.findOne({ clinicId, appointmentDate }).sort({ opNumber: -1 });
    const opNumber = lastAppointmentToday ? lastAppointmentToday.opNumber + 1 : 1;

    // 9️⃣ Create the appointment
    const appointment = new Appointment({
      patientId,
      clinicId,
      doctorId,
      appointmentDate,
      appointmentTime,
      createdBy: receptionistId,
      opNumber,
      status: "scheduled",
    });
    await appointment.save();

    return res.status(201).json({ success: true, message: "Appointment created successfully", appointment });
  } catch (error) {
    console.error("createAppointment error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};




export { createAppointment };

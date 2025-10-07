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
    // 1️⃣ Validate all required fields and formats
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid or missing clinicId" });

    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId))
      return res.status(400).json({ success: false, message: "Invalid or missing patientId" });

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: "Invalid or missing doctorId" });

    if (!receptionistId || !mongoose.Types.ObjectId.isValid(receptionistId))
      return res.status(400).json({ success: false, message: "Invalid or missing receptionistId" });

    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate))
      return res.status(400).json({ success: false, message: "Invalid appointmentDate format (use YYYY-MM-DD)" });

    if (!appointmentTime || !/^\d{2}:\d{2}$/.test(appointmentTime))
      return res.status(400).json({ success: false, message: "Invalid appointmentTime format (use HH:mm)" });

    // 2️⃣ Combine date & time and check if future
    const [hour, minute] = appointmentTime.split(":").map(Number);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
      return res.status(400).json({ success: false, message: "Invalid appointment time values" });

    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
    const now = new Date();
    if (appointmentDateTime.getTime() <= now.getTime())
      return res.status(400).json({ success: false, message: "Cannot book appointment in the past" });

    // 3️⃣ Verify patient exists in the same clinic
    const patient = await Patient.findOne({ _id: patientId, clinicId });
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found in this clinic" });

    // 4️⃣ Verify receptionist belongs to this clinic via Auth Service
    try {
      const staffRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic/all-staffs/${clinicId}`);
      const clinic = staffRes.data?.clinic;

      if (!clinic || !clinic.staffs)
        return res.status(404).json({ success: false, message: "Clinic or staff data unavailable" });

      const receptionistList = clinic.staffs.receptionists || [];
      const isReceptionistInClinic = receptionistList.some(
        (rec) => rec._id.toString() === receptionistId.toString()
      );

      if (!isReceptionistInClinic)
        return res.status(403).json({
          success: false,
          message: "Receptionist does not belong to this clinic",
        });
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: "Unable to verify receptionist from Auth Service",
        error: err.response?.data?.message || err.message,
      });
    }

    // 5️⃣ Fetch doctor availability from Clinic Service
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
        message: "Unable to fetch doctor availability from Clinic Service",
        error: err.response?.data?.message || err.message,
      });
    }

    // 6️⃣ Validate appointment day and time with availability
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const appointmentDayIndex = new Date(appointmentDate).getDay();
    const appointmentDay = daysOfWeek[appointmentDayIndex];
    const appointmentMinutes = hour * 60 + minute;

    const isAvailable = availabilities.some((slot) => {
      const slotClinicId = slot.clinicId?._id || slot.clinicId;
      if (!slotClinicId || slotClinicId.toString() !== clinicId.toString()) return false;

      if (!slot.dayOfWeek || slot.dayOfWeek.toLowerCase() !== appointmentDay.toLowerCase()) return false;

      const [startH, startM] = slot.startTime.split(":").map(Number);
      const [endH, endM] = slot.endTime.split(":").map(Number);

      const slotStart = startH * 60 + startM;
      const slotEnd = endH * 60 + endM;

      return appointmentMinutes >= slotStart && appointmentMinutes < slotEnd;
    });

    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: `Doctor is not available on ${appointmentDay} at ${appointmentTime}`,
      });
    }

    // 7️⃣ Prevent double booking
    const existingAppointment = await Appointment.findOne({
      doctorId,
      clinicId,
      appointmentDate,
      appointmentTime,
      status: { $in: ["scheduled", "confirmed"] },
    });

    if (existingAppointment)
      return res.status(400).json({
        success: false,
        message: "Doctor already has an appointment at this time",
      });

    // 8️⃣ Generate daily OP number per clinic per date
    const lastAppointmentToday = await Appointment.findOne({ clinicId, appointmentDate }).sort({ opNumber: -1 });
    const nextOpNumber = lastAppointmentToday ? lastAppointmentToday.opNumber + 1 : 1;

    // 9️⃣ Create appointment
    const appointment = new Appointment({
      clinicId,
      patientId,
      doctorId,
      appointmentDate,
      appointmentTime,
      createdBy: receptionistId,
      status: "scheduled",
      opNumber: nextOpNumber,
    });

    await appointment.save();

    return res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      data: appointment,
    });
  } catch (error) {
    console.error("❌ createAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating appointment",
      error: error.message,
    });
  }
};

const getTodaysAppointments = async (req, res) => {
  try {
    const { doctorId, clinicId } = req.doctorClinic;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    const appointments = await Appointment.find({
      doctorId,
      clinicId,
      appointmentDate: todayStr,
      status: "scheduled"
    })
    .populate("patientId", "name phone email")
    .sort({ appointmentTime: 1 });

    return res.status(200).json({
      success: true,
      message: `Appointments for today (${todayStr})`,
      doctorId,
      clinicId,
      appointments
    });
  } catch (err) {
    console.error("getTodaysAppointments error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



export { createAppointment ,getTodaysAppointments};

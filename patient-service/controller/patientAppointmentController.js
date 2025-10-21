import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import axios from "axios";
import Patient from "../model/patientSchema.js";
import Appointment from "../model/appointmentSchema.js";
import PatientHistory from "../model/patientHistorySchema.js";

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
const getAppointmentById = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("patientId", "name phone email") // only populate patient
      .lean();

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Appointment details fetched successfully",
      appointment,
    });
  } catch (err) {
    console.error("getAppointmentById error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching appointment details",
      error: err.message,
    });
  }
};
const getPatientHistory = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const { clinicId } = req.body;

    // ✅ 1. Validate IDs
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid patientId" });
    }

    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    // ✅ 2. Fetch patient history (lean + sorted descending by visitDate)
    const history = await PatientHistory.find(
      { patientId, clinicId },
      {
        _id: 1,
        visitDate: 1,
        doctorId: 1,
        appointmentId: 1,
        symptoms: 1,
        diagnosis: 1,
        prescriptions: 1,
        notes: 1,
        files: 1,
        referrals: 1,
        status: 1,
        createdAt: 1,
        consultationFee: 1,      // ✅ ADDED
        procedures: 1,            // ✅ ADDED
        totalAmount: 1,           // ✅ ADDED
        isPaid: 1,                // ✅ ADDED
      }
    )
      .sort({ visitDate: -1 })
      .lean();

    if (!history.length) {
      return res.status(404).json({ success: false, message: "No patient history found" });
    }

    // ✅ 3. Extract unique doctor IDs
    const doctorIds = [...new Set(history.map(h => h.doctorId?.toString()).filter(Boolean))];

    // ✅ 4. Fetch doctor details from microservice in parallel
    const doctorMap = {};
    await Promise.all(
      doctorIds.map(async (doctorId) => {
        try {
          const { data } = await axios.get(
            `${process.env.AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`
          );

          // Corrected access
          if (data?.success && data?.data) {
            doctorMap[doctorId] = {
              name: data.data.name,
              phoneNumber: data.data.phoneNumber,
              specialization: data.data.specialization || null,
            };
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch doctor ${doctorId}:`, err.message);
        }
      })
    );

    // ✅ 5. Merge doctor info into each patient history record
    const enrichedHistory = history.map(h => ({
      ...h,
      doctor: doctorMap[h.doctorId?.toString()] || null,
    }));

    // ✅ 6. Respond
    return res.status(200).json({
      success: true,
      count: enrichedHistory.length,
      data: enrichedHistory,
    });

  } catch (error) {
    console.error("getPatientHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching patient history",
      error: error.message,
    });
  }
};
const addLabOrderToPatientHistory = async (req, res) => {
  try {
    const { id: historyId } = req.params;
    const { labOrderId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(historyId)) {
      return res.status(400).json({ success: false, message: "Invalid patientHistory ID" });
    }

    if (!labOrderId || !mongoose.Types.ObjectId.isValid(labOrderId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing labOrderId" });
    }

    // Push only the labOrderId since labHistory is an array of ObjectIds
    const updatedHistory = await PatientHistory.findByIdAndUpdate(
      historyId,
      { $push: { labHistory: labOrderId } },
      { new: true }
    );

    if (!updatedHistory) {
      return res.status(404).json({ success: false, message: "Patient history not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Lab order added successfully",
      labHistory: updatedHistory.labHistory,
    });
  } catch (error) {
    console.error("Error adding lab order:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding lab order",
      error: error.message,
    });
  }
};
const getAppointmentsByClinic = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const { startDate, endDate, search, limit = 10, lastId } = req.query;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    const query = { clinicId };

    // ✅ Handle date filters
    if (startDate && endDate) {
      query.appointmentDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.appointmentDate = startDate;
    } else {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(today.getDate()).padStart(2, "0")}`;
      query.appointmentDate = todayStr;
    }

    // ✅ Cursor-based pagination
    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
    }

    // ✅ If there's a search term, find matching patient IDs first
    let patientFilter = {};
    if (search) {
      const matchingPatients = await Patient.find(
        {
          clinicId,
          name: { $regex: search, $options: "i" },
        },
        { _id: 1 }
      ).lean();

      const matchingIds = matchingPatients.map((p) => p._id);
      query.patientId = { $in: matchingIds.length ? matchingIds : [null] }; // ensures no false matches
    }

    // ✅ Fetch appointments with populated patient info
    const appointments = await Appointment.find(query)
      .populate({
        path: "patientId",
        select: "name phone email age gender patientUniqueId",
      })
      .sort({ _id: -1 })
      .limit(parseInt(limit))
      .lean();

    // ✅ Total count
    const totalAppointments = await Appointment.countDocuments({
      clinicId,
      appointmentDate: query.appointmentDate,
    });

    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      count: appointments.length,
      totalAppointments,
      data: appointments,
      nextCursor: appointments.length ? appointments[appointments.length - 1]._id : null,
    });
  } catch (error) {
    console.error("getAppointmentsByClinic error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching appointments",
      error: error.message,
    });
  }
};
const clearDoctorFromAppointments = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.body;

    if (!clinicId || !doctorId) {
      return res.status(400).json({
        success: false,
        message: "clinicId and doctorId are required",
      });
    }

    // ✅ Update only scheduled appointments for this doctor in this clinic
    const result = await Appointment.updateMany(
      { clinicId, doctorId, status: "scheduled" },
      { $unset: { doctorId: "" } } // removes doctorId field
    );

    // ✅ Fetch the updated scheduled appointments
    const updatedAppointments = await Appointment.find({
      clinicId,
      doctorId: { $exists: false },
      status: "scheduled", // only include scheduled ones
    })
      .select("_id appointmentDate appointmentTime status patientId")
      .lean();

    return res.status(200).json({
      success: true,
      message: `Doctor removed from ${result.modifiedCount} scheduled appointment(s)`,
      updatedAppointments,
    });
  } catch (error) {
    console.error("❌ clearDoctorFromAppointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while clearing doctor from appointments",
      error: error.message,
    });
  }
};

export { createAppointment ,getTodaysAppointments,getAppointmentById, getPatientHistory, addLabOrderToPatientHistory,getAppointmentsByClinic,clearDoctorFromAppointments};

import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import axios from "axios";
import Patient from "../model/patientSchema.js";
import Appointment from "../model/appointmentSchema.js";
import PatientHistory from "../model/patientHistorySchema.js";
import treatmentPlanSchema from "../model/treatmentPlanSchema.js";

configDotenv();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

const createAppointment = async (req, res) => {
  const { id: clinicId } = req.params;
  const {
    userId,
    userRole,
    patientId,
    doctorId,
    department,
    appointmentDate,
    appointmentTime,
    forceBooking 
  } = req.body;

  try {
    // 1️⃣ Basic validations
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId))
      return res.status(400).json({ success: false, message: "Invalid patientId" });
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: "Invalid doctorId" });
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, message: "Invalid userId" });
    if (!userRole || !["receptionist", "admin"].includes(userRole))
      return res.status(400).json({ success: false, message: "Invalid userRole" });
    if (!department)
      return res.status(400).json({ success: false, message: "Department is required" });
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate))
      return res.status(400).json({ success: false, message: "Invalid appointmentDate format" });
    if (!appointmentTime || !/^\d{2}:\d{2}$/.test(appointmentTime))
      return res.status(400).json({ success: false, message: "Invalid appointmentTime format" });

    // 2️⃣ Time validation
    const [hour, minute] = appointmentTime.split(":").map(Number);
    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
    if (appointmentDateTime <= new Date())
      return res.status(400).json({ success: false, message: "Cannot book appointment in the past" });

    // 3️⃣ Validate patient and receptionist
    const patient = await Patient.findOne({ _id: patientId, clinicId });
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found in this clinic" });

    // Fetch clinic details early for notification
    let clinicName = "Our Clinic";
    try {
      const clinicRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${clinicId}`);
      clinicName = clinicRes.data?.data?.name || clinicRes.data?.name || "Our Clinic";
      console.log(`✅ Clinic name fetched: ${clinicName}`);
    } catch (err) {
      console.warn("Could not fetch clinic name:", err.message);
    }

    if (userRole === "receptionist") {
      try {
        const staffRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic/all-staffs/${clinicId}`);
        const staff = staffRes.data?.staff;
        const isReceptionistInClinic = staff?.receptionists?.some(
          (rec) => rec._id.toString() === userId.toString()
        );
        if (!isReceptionistInClinic)
          return res.status(403).json({ success: false, message: "Receptionist does not belong to this clinic" });
      } catch (err) {
        return res.status(503).json({
          success: false,
          message: "Unable to verify receptionist from Auth Service",
          error: err.response?.data?.message || err.message,
        });
      }
    }

    // 4️⃣ Referral logic (no populate, use clinic-service API)
    const activeReferral = await PatientHistory.findOne({
      patientId,
      clinicId,
      "referral.status": "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (activeReferral?.referral?.referredToDoctorId) {
      try {
        const doctorRes = await axios.get(
          `${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${clinicId}`
        );

        const allDoctors = doctorRes.data?.doctors || [];
        const referredDoctor = allDoctors.find(
          (doc) => doc.doctorId?.toString() === activeReferral.referral.referredToDoctorId.toString()
        );

        if (referredDoctor) {
          activeReferral.referral.referredToDoctor = {
            name: referredDoctor.doctor?.name,
            specialization: referredDoctor.doctor?.specialization,
            doctorId: referredDoctor.doctorId,
          };
        }

        if (
          !forceBooking &&
          referredDoctor &&
          referredDoctor.doctorId.toString() !== doctorId.toString()
        ) {
          return res.status(409).json({
            success: false,
            message: `This patient has a pending referral to ${referredDoctor.doctor?.name} (${referredDoctor.doctor?.specialization}). Please advise the patient before booking another doctor.`,
            referral: activeReferral.referral,
            requireConfirmation: true,
          });
        }

        if (referredDoctor && referredDoctor.doctorId.toString() === doctorId.toString()) {
          await PatientHistory.updateOne(
            { _id: activeReferral._id },
            { $set: { "referral.status": "accepted" } }
          );
        }
      } catch (err) {
        console.warn("Could not fetch referred doctor details:", err.message);
      }
    }

    // 5️⃣ 🆕 Doctor availability - Check but DON'T block booking
    let availabilities = [];
    let doctorAvailable = false;
    let availabilityWarning = null;
    
    try {
      const availRes = await axios.get(`${CLINIC_SERVICE_BASE_URL}/availability`, {
        params: { doctorId, clinicId },
      });

      console.log("🔍 Availability API response:", JSON.stringify(availRes.data, null, 2));

      const availData = availRes.data?.availabilities || [];
      
      if (availData.length > 0) {
        // Format availabilities - API already filters for isActive slots
        availabilities = availData.map(slot => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: true,
          clinic: { _id: typeof slot.clinic === 'string' ? slot.clinic : slot.clinic?._id || clinicId }
        }));

        console.log("✅ Active availabilities formatted:", availabilities);

        // 6️⃣ Check if appointment time falls within availability
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const appointmentDay = daysOfWeek[new Date(appointmentDate).getDay()];
        const appointmentMinutes = hour * 60 + minute;

        console.log("🔍 Checking availability for:", { 
          appointmentDay, 
          appointmentTime, 
          appointmentMinutes,
          clinicId 
        });

        doctorAvailable = availabilities.some((slot) => {
          const slotClinicId = slot.clinic?._id || slot.clinic;
          
          if (!slotClinicId || slotClinicId.toString() !== clinicId.toString()) {
            return false;
          }
          
          if (!slot.dayOfWeek || slot.dayOfWeek.toLowerCase() !== appointmentDay.toLowerCase()) {
            return false;
          }
          
          const [startH, startM] = slot.startTime.split(":").map(Number);
          const [endH, endM] = slot.endTime.split(":").map(Number);
          const slotStart = startH * 60 + startM;
          const slotEnd = endH * 60 + endM;
          
          const isInRange = appointmentMinutes >= slotStart && appointmentMinutes < slotEnd;
          
          console.log(`🔍 Time check: ${appointmentMinutes} in range [${slotStart}, ${slotEnd})? ${isInRange}`);
          
          return isInRange;
        });

        if (!doctorAvailable) {
          availabilityWarning = `Doctor is not available on ${appointmentDay} at ${appointmentTime}. Appointment booked but may need rescheduling.`;
          console.log(`⚠️ ${availabilityWarning}`);
        }
      } else {
        availabilityWarning = "Doctor has no availability schedule set. Appointment booked but may need confirmation.";
        console.log(`⚠️ ${availabilityWarning}`);
      }
    } catch (err) {
      console.warn("⚠️ Unable to fetch doctor availability:", err.message);
      availabilityWarning = "Unable to verify doctor availability. Appointment booked but may need confirmation.";
    }

    // 7️⃣ Prevent double booking (still enforce this - important!)
    const existingAppointment = await Appointment.findOne({
      doctorId,
      clinicId,
      appointmentDate,
      appointmentTime,
      status: { $in: ["scheduled", "confirmed"] },
    });
    if (existingAppointment)
      return res.status(400).json({ success: false, message: "Doctor already has an appointment at this time" });

    // 8️⃣ Generate OP number
    const lastAppointmentToday = await Appointment.findOne({ clinicId, appointmentDate }).sort({ opNumber: -1 });
    const nextOpNumber = lastAppointmentToday ? Number(lastAppointmentToday.opNumber) + 1 : 1;

    // 9️⃣ Create appointment (always create, with appropriate status based on availability)
    const appointment = new Appointment({
      clinicId,
      patientId,
      doctorId,
      department,
      appointmentDate,
      appointmentTime,
      createdBy: userId,
      status: doctorAvailable ? "scheduled" : "needs_reschedule",
      opNumber: nextOpNumber,
      doctorAvailable, // Store availability flag in appointment
    });
    await appointment.save();

    // 🔟 Send confirmation notification (non-blocking)
    try {
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/send-confirmation`, {
        appointmentId: appointment._id,
        clinicId,
        patientId,
        doctorId,
        appointmentDate,
        appointmentTime,
        opNumber: nextOpNumber,
        clinicName
      });
      console.log("✅ Confirmation notification sent to patient");
    } catch (notifError) {
      console.error("⚠️ Notification failed but appointment created:", notifError.message);
    }

    // Return success with status-appropriate message
    return res.status(201).json({
      success: true,
      message: doctorAvailable 
        ? "Appointment created successfully"
        : "Doctor not available — appointment booked but marked for reschedule.",
      data: appointment,
      doctorAvailable // Flag for frontend
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
    const doctorId = req.doctorId;
    const { search = "", cursor = null, limit = 10, date } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "Missing doctorId in token",
      });
    }

    // 🗓️ Build today's date string
    const targetDate = date ? new Date(date) : new Date();
    const todayStr = `${targetDate.getFullYear()}-${String(
      targetDate.getMonth() + 1
    ).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

    const matchStage = {
      doctorId: new mongoose.Types.ObjectId(doctorId),
      appointmentDate: todayStr,
      status: "scheduled",
    };

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      matchStage._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pipeline = [
      { $match: matchStage },

      // 👤 Lookup patient info
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
    ];

    // 🔍 Optional search
    if (search.trim() !== "") {
      const s = search.trim();
      const searchRegex = new RegExp(s, "i");
      pipeline.push({
        $match: {
          $or: [
            { "patient.name": searchRegex },
            { "patient.phone": { $regex: s } },
            { "patient.patientUniqueId": searchRegex },
          ],
        },
      });
    }

    // 🧩 Sort & group by clinic
    pipeline.push({ $sort: { _id: -1 } });
    pipeline.push({
      $group: {
        _id: "$clinicId",
        appointments: {
          $push: {
            _id: "$_id",
            appointmentDate: "$appointmentDate",
            appointmentTime: "$appointmentTime",
            status: "$status",
            opNumber: "$opNumber",
            patient: {
              _id: "$patient._id",
              name: "$patient.name",
              phone: "$patient.phone",
              age: "$patient.age",
              gender: "$patient.gender",
              patientUniqueId: "$patient.patientUniqueId",
            },
          },
        },
      },
    });
    pipeline.push({ $limit: Number(limit) });

    const groupedAppointments = await Appointment.aggregate(pipeline);

    // ⚡ Cache to avoid multiple network calls for same clinic
    const clinicCache = {};

    // ---- 🔗 Fetch minimal clinic details (name + phoneNumber) ----
    const results = await Promise.all(
      groupedAppointments.map(async (group) => {
        if (!group._id) {
          return {
            clinicId: null,
            clinicName: "Unknown Clinic",
            clinicPhone: null,
            appointments: group.appointments,
          };
        }

        // ✅ Use cached value if available
        if (clinicCache[group._id]) {
          return { ...clinicCache[group._id], appointments: group.appointments };
        }

        let clinicName = "Unknown Clinic";
        let clinicPhone = null;

        try {
          const response = await axios.get(
            `${AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${group._id}`
          );
          const clinic = response.data?.data;
          if (clinic) {
            clinicName = clinic.name || clinicName;
            clinicPhone = clinic.phoneNumber || null;
          }
        } catch (err) {
          console.warn(
            `⚠️ Failed to fetch clinic details for ${group._id}:`,
            err.message
          );
        }

        const clinicObj = {
          clinicId: group._id,
          clinicName,
          clinicPhone,
        };

        clinicCache[group._id] = clinicObj; // 🧠 Cache it

        return {
          ...clinicObj,
          appointments: group.appointments,
        };
      })
    );

    const nextCursor =
      groupedAppointments.length > 0
        ? groupedAppointments[groupedAppointments.length - 1]?.appointments?.slice(-1)[0]?._id
        : null;

    return res.status(200).json({
      success: true,
      message: "Today's appointments fetched successfully",
      count: results.length,
      limit: Number(limit),
      nextCursor,
      hasMore: !!nextCursor,
      data: results,
    });
  } catch (err) {
    console.error("getTodaysAppointments error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching today's appointments",
      error: err.message,
    });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("patientId", "name phone email age") // only populate patient
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
  const { clinicId } = req.query;

    // ✅ 1. Validate IDs
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid patientId" });
    }
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    // ✅ 2. Fetch patient history
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
        consultationFee: 1,
        procedures: 1,
        totalAmount: 1,
        isPaid: 1,
        treatmentPlanId: 1,
      }
    )
      .sort({ visitDate: -1 })
      .lean();

    if (!history.length) {
      return res.status(404).json({ success: false, message: "No patient history found" });
    }

    // ✅ 3. Extract unique doctor & treatment plan IDs
    const doctorIds = [...new Set(history.map(h => h.doctorId?.toString()).filter(Boolean))];
    const treatmentPlanIds = [...new Set(history.map(h => h.treatmentPlanId?.toString()).filter(Boolean))];

    // ✅ 4. Fetch doctor details (microservice)
    const doctorMap = {};
    await Promise.all(
      doctorIds.map(async (doctorId) => {
        try {
          const { data } = await axios.get(
            `${process.env.AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`
          );
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

    // ✅ 5. Fetch treatment plan details
    const treatmentPlans = await mongoose.model("TreatmentPlan").find(
      { _id: { $in: treatmentPlanIds } },
      "planName description status createdAt completedAt stages"
    ).lean();

    const treatmentPlanMap = treatmentPlans.reduce((acc, plan) => {
      acc[plan._id.toString()] = plan;
      return acc;
    }, {});

    // ✅ 6. Merge doctor & treatment plan info into each history
    const enrichedHistory = history.map(h => ({
      ...h,
      doctor: doctorMap[h.doctorId?.toString()] || null,
      treatmentPlan: h.treatmentPlanId
        ? treatmentPlanMap[h.treatmentPlanId.toString()] || null
        : null,
    }));

    // ✅ 7. Respond
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

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Calculate tomorrow’s date in same format (YYYY-MM-DD)
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    // Date filter
    if (startDate && endDate) query.appointmentDate = { $gte: startDate, $lte: endDate };
    else if (startDate) query.appointmentDate = startDate;
    else query.appointmentDate = todayStr;

    // Cursor pagination
    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    // Search by patient name or ID
    if (search?.trim()) {
      const matchingIds = await Patient.find(
        {
          clinicId,
          $or: [
            { name: { $regex: search, $options: "i" } },
            { patientUniqueId: { $regex: search, $options: "i" } },
          ],
        },
        { _id: 1 }
      )
        .lean()
        .limit(50)
        .then((res) => res.map((p) => p._id));

      query.patientId = matchingIds.length ? { $in: matchingIds } : { $in: [] };
    }

    // Fetch appointments
    const appointments = await Appointment.find(query)
      .sort({ _id: 1 })
      .limit(Number(limit))
      .populate("patientId", "name phone email age gender patientUniqueId")
      .select("patientId appointmentDate appointmentTime opNumber status createdAt")
      .lean();

    const totalAppointments = await Appointment.countDocuments({
      clinicId,
      appointmentDate: query.appointmentDate,
    });

    // Cursor pagination
    const nextCursor =
      appointments.length === Number(limit)
        ? appointments[appointments.length - 1]._id
        : null;

    // Daily stats aggregation
    const counts = await Appointment.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          appointmentDate: query.appointmentDate,
        },
      },
      {
        $group: {
          _id: null,
          totalAppointments: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          scheduledCount: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
        },
      },
    ]);

    const stats =
      counts[0] || {
        totalAppointments: 0,
        completedCount: 0,
        cancelledCount: 0,
        scheduledCount: 0,
      };

    // 🟡 New: Tomorrow’s "needs_reschedule" appointments
    const tomorrowRescheduleCount = await Appointment.countDocuments({
      clinicId,
      appointmentDate: tomorrowStr,
      status: { $in: ["rescheduled", "needs_reschedule"] },
    });

    // Final response
    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      data: appointments,
      totalAppointments,
      nextCursor,
      stats,
      tomorrowRescheduleCount, // 👈 new key for admin dashboard
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
const appointmentReschedule = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
    const {
      doctorId,
      newDate,
      newTime,
      userId,
      userRole,
      forceReschedule
    } = req.body;
    if (!mongoose.Types.ObjectId.isValid(appointmentId))
      return res.status(400).json({ success: false, message: "Invalid appointmentId" });

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: "Invalid doctorId" });

    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate))
      return res.status(400).json({ success: false, message: "Invalid newDate format" });

    if (!newTime || !/^\d{2}:\d{2}$/.test(newTime))
      return res.status(400).json({ success: false, message: "Invalid newTime format" });

    if (!["admin", "receptionist"].includes(userRole))
      return res.status(400).json({ success: false, message: "Invalid userRole" });

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res.status(404).json({ success: false, message: "Appointment not found" });
    const selectedDateTime = new Date(`${newDate}T${newTime}:00`);
    if (selectedDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot reschedule to a past time"
      });
    }

    const clinicId = appointment.clinicId;
    const department = appointment.department;
    if (appointment.status !== "needs_reschedule" && !forceReschedule) {
      return res.status(400).json({
        success: false,
        message: "Cannot reschedule this appointment without forceReschedule=true"
      });
    }
let doctorAvailable = false;
let availabilities = [];

try {
  const availRes = await axios.get(
    `${CLINIC_SERVICE_BASE_URL}/department-based/availability`,
    { params: { doctorId, clinicId, department } }
  );

  // ✔ Match correct doctor
  const doctors = availRes.data?.doctors || [];
  const matchedDoctor = doctors.find(
    (d) => d.doctorId?.toString() === doctorId.toString()
  );

  availabilities = matchedDoctor?.availability || [];

  if (availabilities.length) {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const selectedDay = days[new Date(newDate).getDay()];
    const [h, m] = newTime.split(":").map(Number);
    const appointmentMinutes = h * 60 + m;

    doctorAvailable = availabilities.some((slot) => {
      const slotClinicId = slot.clinic?._id || slot.clinic;
      if (!slotClinicId || slotClinicId.toString() !== clinicId.toString()) return false;
      if (!slot.isActive) return false;
      if (!slot.dayOfWeek || slot.dayOfWeek.toLowerCase() !== selectedDay.toLowerCase()) return false;
      const [startH, startM] = slot.startTime.split(":").map(Number);
      const [endH, endM] = slot.endTime.split(":").map(Number);
      const slotStart = startH * 60 + startM;
      const slotEnd = endH * 60 + endM;
      return appointmentMinutes >= slotStart && appointmentMinutes < slotEnd;
    });
  }

} catch (err) {
  console.log("⚠️ Error fetching availability:", err.message);
}



    if (!doctorAvailable) {
      return res.status(400).json({
        success: false,
        message: "Doctor not available at the selected time"
      });
    }
    const conflict = await Appointment.findOne({
      doctorId,
      clinicId,
      appointmentDate: newDate,
      appointmentTime: newTime,
      status: { $in: ["scheduled", "confirmed"] },
      _id: { $ne: appointmentId }
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: "Doctor already has an appointment at this time"
      });
    }
    appointment.doctorId = doctorId;
    appointment.appointmentDate = newDate;
    appointment.appointmentTime = newTime;
    appointment.updatedBy = userId;
   appointment.status = doctorAvailable ? "scheduled" : "needs_reschedule";
appointment.doctorAvailable = doctorAvailable;


    await appointment.save();

    return res.status(200).json({
  success: true,
  forceUsed: !!forceReschedule,
  doctorAvailable,
  message: doctorAvailable
    ? "Appointment rescheduled successfully."
    : "Appointment rescheduled but marked for reschedule — doctor not available.",
  data: appointment
});


  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while rescheduling appointment",
      error: error.message,
    });
  }
};



const cancelAppointment = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
    const { cancelledBy } = req.body; 

    // ✅ Validate appointmentId
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointmentId" });
    }

    // ✅ Fetch appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // ✅ Check if already cancelled or completed
    if (appointment.status !== "scheduled") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an appointment with status "${appointment.status}"`,
      });
    }

    // ✅ Update status to cancelled
    appointment.status = "cancelled";
    appointment.updatedBy = cancelledBy || null;

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment,
    });
  } catch (error) {
    console.error("❌ cancelAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while cancelling appointment",
      error: error.message,
    });
  }
};
const getPatientTreatmentPlans = async (req, res) => {
  try {
    const { id:patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    // ✅ Fetch all treatment plans for this patient
    const treatmentPlans = await treatmentPlanSchema.find({ patientId })
      .populate({
        path: "patientId",
        select: "name phone email patientUniqueId patientRandomId",
      })
      .populate({
        path: "clinicId",
        select: "name phone address",
      })
      .populate({
        path: "createdByDoctorId",
        select: "name specialization phoneNumber",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: treatmentPlans.length,
      data: treatmentPlans,
    });
  } catch (error) {
    console.error("❌ Error fetching treatment plans:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching treatment plans",
      error: error.message,
    });
  }
};
const getAppointmentsByDate = async (req, res) => {
  try {
    const { date, status } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const query = { appointmentDate: date };
    
    if (status) {
      query.status = status;
    }
    
    // ✅ FIXED: Only populate patientId
    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone whatsappNumber')
      .sort({ appointmentTime: 1 })
      .lean();
    
    console.log(`📋 Found ${appointments.length} appointments for ${date}`);
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
    
  } catch (error) {
    console.error('❌ Error fetching appointments by date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};
export { createAppointment ,getTodaysAppointments,getAppointmentById, getPatientHistory, addLabOrderToPatientHistory,getAppointmentsByClinic,clearDoctorFromAppointments,appointmentReschedule, cancelAppointment,getPatientTreatmentPlans,getAppointmentsByDate};

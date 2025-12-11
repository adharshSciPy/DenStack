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
    // ===================== 1️⃣ Basic Validations =====================
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


    // ===================== 2️⃣ Time Validation =====================
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const [hour, minute] = appointmentTime.split(":").map(Number);
    const appointmentDateTime = new Date(year, month - 1, day, hour, minute);

    if (appointmentDateTime <= new Date())
      return res.status(400).json({ success: false, message: "Cannot book appointment in the past" });


    // ===================== 3️⃣ Validate Patient & User =====================
    const patient = await Patient.findOne({ _id: patientId, clinicId });
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found in this clinic" });

    // Validate receptionist belongs to clinic
    if (userRole === "receptionist") {
      try {
        const staffRes = await axios.get(
          `${AUTH_SERVICE_BASE_URL}/clinic/all-staffs/${clinicId}`
        );

        const staff = staffRes.data?.staff;

        const isReceptionistInClinic = staff?.receptionists?.some(
          (rec) => rec._id.toString() === userId.toString()
        );

        if (!isReceptionistInClinic) {
          return res.status(403).json({
            success: false,
            message: "Receptionist does not belong to this clinic"
          });
        }
      } catch (err) {
        return res.status(503).json({
          success: false,
          message: "Unable to verify receptionist from Auth Service",
          error: err.message
        });
      }
    }


    // ===================== 4️⃣ Referral Logic =====================
    const activeReferral = await PatientHistory.findOne({
      patientId,
      clinicId,
      "referral.status": "pending"
    }).sort({ createdAt: -1 }).lean();

    if (activeReferral?.referral?.referredToDoctorId) {
      try {
        const docRes = await axios.get(
          `${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${clinicId}`
        );

        const doctors = docRes.data?.doctors || [];

        const referredDoctor = doctors.find(
          d => d.doctorId?.toString() === activeReferral.referral.referredToDoctorId.toString()
        );

        if (
          !forceBooking &&
          referredDoctor &&
          referredDoctor.doctorId.toString() !== doctorId.toString()
        ) {
          return res.status(409).json({
            success: false,
            message: `Patient has a pending referral to ${referredDoctor?.doctor?.name}`,
            referral: {
              doctorId: referredDoctor.doctorId,
              name: referredDoctor.doctor?.name,
              specialization: referredDoctor.doctor?.specialization
            },
            requireConfirmation: true
          });
        }

        if (referredDoctor && referredDoctor.doctorId.toString() === doctorId.toString()) {
          await PatientHistory.updateOne(
            { _id: activeReferral._id },
            { $set: { "referral.status": "accepted" } }
          );
        }
      } catch (err) {
        console.warn("Referral doctor fetch failed:", err.message);
      }
    }


    // ===================== 5️⃣ Doctor Availability (department based) =====================
    let doctorAvailable = false;
    let availabilityMatchedSlot = null;

    try {
      const availRes = await axios.get(
        `${CLINIC_SERVICE_BASE_URL}/department-based/availability`,
        { params: { clinicId, department } }
      );

      const doctorData = availRes.data?.doctors?.find(
        (doc) => doc.doctorId.toString() === doctorId.toString()
      );

      const availabilities = doctorData?.availability || [];

      if (availabilities.length) {
        const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const appointmentDay = days[appointmentDateTime.getDay()];
        const appointmentMinutes = hour * 60 + minute;

        doctorAvailable = availabilities.some((slot) => {
          if (!slot.isActive) return false;

          const slotClinicId = slot.clinicId?.toString() || slot.clinicId;
          if (slotClinicId !== clinicId.toString()) return false;

          if (slot.dayOfWeek?.toLowerCase() !== appointmentDay.toLowerCase()) return false;

          const [sh, sm] = slot.startTime.split(":").map(Number);
          const [eh, em] = slot.endTime.split(":").map(Number);

          const start = sh * 60 + sm;
          const end = eh * 60 + em;

          const match = appointmentMinutes >= start && appointmentMinutes < end;

          if (match) availabilityMatchedSlot = slot;

          return match;
        });
      }
    } catch (err) {
      console.warn("Doctor availability check failed:", err.message);
    }


    // ===================== 6️⃣ Prevent Double Booking =====================
    const existingAppointment = await Appointment.findOne({
      doctorId,
      clinicId,
      appointmentDate,
      appointmentTime,
      status: { $in: ["scheduled", "confirmed"] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: "Doctor already has an appointment at this time"
      });
    }


    // ===================== 7️⃣ Generate OP Number =====================
    const lastAppointment = await Appointment.findOne({
      clinicId,
      appointmentDate
    }).sort({ opNumber: -1 });

    const nextOpNumber = lastAppointment ? Number(lastAppointment.opNumber) + 1 : 1;


    // ===================== 8️⃣ Create Appointment =====================
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
  doctorAvailable,
  availabilityMatchedSlot
});

await appointment.save();

// ===================== 9️⃣ Send Confirmation Notification =====================
// Fetch clinic name for notification
let clinicName = "Our Clinic";
try {
  const clinicRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${clinicId}`);
  clinicName = clinicRes.data?.data?.name || clinicRes.data?.name || "Our Clinic";
} catch (err) {
  console.warn("Could not fetch clinic name:", err.message);
}

// Send notification (non-blocking)
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
  console.log("✅ Confirmation notification sent");
} catch (notifError) {
  console.error("⚠️ Notification failed but appointment created:", notifError.message);
}

// ===================== 🔟 Return Response =====================
return res.status(201).json({
  success: true,
  message: doctorAvailable
    ? "Appointment created successfully"
    : "Doctor unavailable — appointment marked for reschedule",
  data: appointment
});

  } catch (error) {
    console.error("Error in createAppointment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating appointment",
      error: error.message
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
    status: { $in: ["scheduled", "needs_reschedule"] }
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
    let { startDate, endDate, search, limit = 10, lastId } = req.query;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    const query = { clinicId };

    // Date format helper
    const today = new Date();
    const formatDate = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    startDate = startDate || formatDate(today);
    endDate = endDate || startDate;

    query.appointmentDate = { $gte: startDate, $lte: endDate };

    // Cursor pagination
    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    // Search patients
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
        .limit(50);

      query.patientId = matchingIds.length
        ? { $in: matchingIds.map((p) => p._id) }
        : { $in: [] };
    }

    // =====================================
    // MAIN APPOINTMENT FETCH
    // =====================================
    const appointments = await Appointment.find(query)
      .sort({ doctorId: 1, appointmentTime: 1 })
      .limit(Number(limit))
      .populate("patientId", "name phone email age gender patientUniqueId")
      .select(
        "patientId appointmentDate appointmentTime opNumber status createdAt doctorId"
      )
      .lean();

    const totalAppointments = await Appointment.countDocuments({
      clinicId,
      appointmentDate: query.appointmentDate,
    });

    const nextCursor =
      appointments.length === Number(limit)
        ? appointments[appointments.length - 1]._id
        : null;

    // ==========================================
    // ⭐ FIXED DOCTOR-WISE GROUPING
    // ==========================================
    const activeDoctors = await axios
      .get(`${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${clinicId}`)
      .then((r) => r.data?.doctors || []);

    const doctorWise = activeDoctors.map((doc) => {
      const docId = doc.doctorId?.toString(); // correct ID to match appointments

      const groupedAppointments = appointments.filter(
        (a) => a.doctorId?.toString() === docId
      );

      return {
        doctor: doc.doctor,
        meta: {
          roleInClinic: doc.roleInClinic,
          status: doc.status,
          standardConsultationFee: doc.standardConsultationFee,
        },
        appointments: groupedAppointments,
      };
    });

    // =====================
    // DAILY STATS
    // =====================
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

    // ===========================
    // Tomorrow reschedule count
    // ===========================
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = formatDate(nextDay);

    const tomorrowRescheduleCount = await Appointment.countDocuments({
      clinicId,
      appointmentDate: nextDayStr,
      status: { $in: ["rescheduled", "needs_reschedule"] },
    });

    // ===========================
    // Missing OP numbers
    // ===========================
    const appointmentsInRange = await Appointment.find({
      clinicId,
      appointmentDate: { $gte: startDate, $lte: endDate },
      opNumber: { $exists: true },
    })
      .sort({ appointmentDate: 1, opNumber: 1 })
      .select("appointmentDate opNumber status")
      .lean();

    const opNumbers = appointmentsInRange
      .map((a) => a.opNumber)
      .sort((a, b) => a - b);

    const missingOps = [];
    let lastOp = 0;

    for (const op of opNumbers) {
      if (op > lastOp + 1) {
        for (let i = lastOp + 1; i < op; i++) missingOps.push(i);
      }
      lastOp = op;
    }

    // ===========================
    // FINAL RESPONSE
    // ===========================
    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      data: appointments,
      doctorWise,
      totalAppointments,
      nextCursor,
      stats,
      tomorrowRescheduleCount,
      missingOps,
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

    console.log("\n===== 🔄 appointmentReschedule Called =====");
    console.log("Params:", req.params);
    console.log("Body:", req.body);

    // -------------------- VALIDATIONS --------------------
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

    // -------------------- FETCH APPOINTMENT --------------------
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res.status(404).json({ success: false, message: "Appointment not found" });

    const clinicId = appointment.clinicId;
    const department = appointment.department;

    // Prevent unwanted reschedule
    if (appointment.status !== "needs_reschedule" && !forceReschedule) {
      return res.status(400).json({
        success: false,
        message: "Cannot reschedule unless marked for reschedule OR forceReschedule=true"
      });
    }

    // Prevent booking past date
    const selectedDateTime = new Date(`${newDate}T${newTime}:00`);
    if (selectedDateTime <= new Date()) {
      return res.status(400).json({ success: false, message: "Cannot reschedule to a past time" });
    }

    // -------------------- AVAILABILITY CHECK --------------------
    console.log("🔍 Checking doctor availability...");

    let doctorAvailable = false;
    let availabilities = [];

    try {
      const availRes = await axios.get(`${CLINIC_SERVICE_BASE_URL}/department-based/availability`, {
        params: { clinicId, department }
      });

      console.log("Availability response received.");

      // Match correct doctor
      const matchedDoctor = availRes.data?.doctors?.find(
        (doc) => doc.doctorId?.toString() === doctorId.toString()
      );

      if (!matchedDoctor) {
        console.log("❌ Doctor not found in availability list");
      } else {
        availabilities = matchedDoctor.availability || [];
        console.log("Matched availability slots:", availabilities);
      }

      if (availabilities.length) {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const selectedDay = days[new Date(newDate).getDay()];
        const [h, m] = newTime.split(":").map(Number);
        const appointmentMinutes = h * 60 + m;

        doctorAvailable = availabilities.some(slot => {
          console.log("Evaluating slot:", slot);

          if (!slot.isActive) return false;

          const slotClinicId = slot.clinicId?.toString();
          if (!slotClinicId || slotClinicId !== clinicId.toString()) return false;

          if (!slot.dayOfWeek || slot.dayOfWeek.toLowerCase() !== selectedDay.toLowerCase())
            return false;

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

    console.log("Doctor Available:", doctorAvailable);

    // -------------------- CONFLICT CHECK --------------------
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
        message: "Doctor already has another appointment at this time"
      });
    }
    console.log("🔹 Determining OP number...");

const isSameDate = appointment.appointmentDate === newDate;
let updatedOpNumber = appointment.opNumber; // default if same date
let rescheduledFromOp = appointment.rescheduledFromOp || null;

if (!isSameDate) {
  console.log("📆 Date changed → clearing OP number for future day");

  // Store original OP to show badge
  rescheduledFromOp = appointment.opNumber;

  // Clear OP number, future day will assign manually
  updatedOpNumber = null;
} else {
  console.log("📌 Same day → keeping existing OP number:", updatedOpNumber);
}


    // -------------------- UPDATE APPOINTMENT --------------------
    appointment.doctorId = doctorId;
    appointment.appointmentDate = newDate;
    appointment.appointmentTime = newTime;
    appointment.updatedBy = userId;
    appointment.status = doctorAvailable ? "scheduled" : "needs_reschedule";
    appointment.doctorAvailable = doctorAvailable;
     appointment.opNumber = updatedOpNumber;
     appointment.rescheduledFromOp = rescheduledFromOp;

    await appointment.save();

    console.log("✅ Appointment updated successfully");

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
    console.error("❌ appointmentReschedule Error:", error);
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
const addReceptionBilling = async (req, res) => {
  try {
    const { clinicId, patientUniqueId } = req.query;
    const {
      procedureCharges = [],
      consumableCharges = [],
      userId,
      userRole,
    } = req.body;

    if (!clinicId || !patientUniqueId) {
      return res.status(400).json({
        success: false,
        message: "clinicId and patientUniqueId are required",
      });
    }

    // Validate role + userId exists
    if (!userId || !userRole) {
      return res.status(400).json({
        success: false,
        message: "userId and userRole are required in body",
      });
    }

    // 1️⃣ Find patient
    const patient = await Patient.findOne({ clinicId, patientUniqueId });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found in this clinic",
      });
    }

    // 2️⃣ Get latest unpaid visit
    const history = await PatientHistory.findOne({
      clinicId,
      patientId: patient._id,
      $or: [
        { isPaid: false },
        { fullPaid: false },
        { paymentCompleted: false },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(false);

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "No unpaid visit found for this patient",
      });
    }

    // 3️⃣ Merge new billing data
    history.receptionBilling = {
      ...history.receptionBilling,
      procedureCharges: [
        ...(history.receptionBilling?.procedureCharges || []),
        ...procedureCharges,
      ],
      consumableCharges: [
        ...(history.receptionBilling?.consumableCharges || []),
        ...consumableCharges,
      ],
      updatedBy: { userId, role: userRole },
      updatedAt: new Date(),
    };

    // 4️⃣ Recalculate total
    if (typeof history.calculateTotalAmount === "function") {
      history.calculateTotalAmount();
    }

    await history.save();

    return res.json({
      success: true,
      message: "Billing updated to latest unpaid visit",
      totalAmount: history.totalAmount,
      history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
//this should be used for getting the unpaid bills from the clinic 
// Helper — find patientIds via patientUniqueId search
async function getPatientIdsByUniqueId(search, clinicId) {
  const regex = new RegExp(search, "i");

  const patients = await mongoose.model("Patient").find({
    patientUniqueId: regex,
    clinicId
  }).select("_id");

  return patients.map(p => p._id);
}
const getUnpaidBillsByClinic = async (req, res) => {
  try {
    const { id:clinicId } = req.params;
    const {
      lastId,                   
      limit = 10,               
      search = "",              
      startDate,
      endDate
    } = req.query;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }
    const query = {
      clinicId,
      isPaid: false,
    };
    if (search) {
      query["patientId"] = await getPatientIdsByUniqueId(search, clinicId);
      if (query["patientId"].length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          hasMore: false
        });
      }
    }

    // 📅 Date filter
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    // If no dates passed → fetch today's unpaid bills
    if (!startDate && !endDate) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    query.visitDate = { $gte: start, $lte: end };

    // 🧭 Cursor Pagination
    if (lastId) {
      query._id = { $gt: lastId };
    }

    // -------------------------
    // 📌 Fetch data
    // -------------------------
    const bills = await PatientHistory.find(query)
      .populate("patientId", "name patientUniqueId phone")
      .sort({ _id: 1 })          // ensure cursor pagination
      .limit(Number(limit) + 1)  // fetch one extra to check hasMore
      .lean();

    const hasMore = bills.length > limit;

    if (hasMore) bills.pop(); // remove the extra record

    res.status(200).json({
      success: true,
      data: bills,
      nextCursor: hasMore ? bills[bills.length - 1]._id : null,
      hasMore
    });

  } catch (error) {
    console.error("Error fetching unpaid bills:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unpaid bills",
      error: error.message
    });
  }
};




export { createAppointment ,getTodaysAppointments,getAppointmentById, getPatientHistory, addLabOrderToPatientHistory,getAppointmentsByClinic,clearDoctorFromAppointments,appointmentReschedule, cancelAppointment,getPatientTreatmentPlans,getAppointmentsByDate,addReceptionBilling,getUnpaidBillsByClinic};

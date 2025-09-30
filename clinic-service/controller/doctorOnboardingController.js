import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import DoctorClinic from "../model/doctorOnboardingSchema.js";
import DoctorAvailability from "../model/doctorAvailabilitySchema.js"

dotenv.config();

const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const onboardDoctor = async (req, res) => {
  try {
    const { clinicId, doctorUniqueId, roleInClinic, createdBy } = req.body;

    // Validate clinicId
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    if (!doctorUniqueId) {
      return res.status(400).json({ success: false, message: "doctorUniqueId is required" });
    }

    // ✅ Fetch doctor from auth-service by uniqueId
    let doctor;
    try {
      const url = `${AUTH_SERVICE_BASE_URL}/doctor/details-uniqueid/${doctorUniqueId}`;
      const response = await axios.get(url);

      if (response.data?.success && response.data.doctor) {
        doctor = response.data.doctor;
      } else {
        return res.status(404).json({ success: false, message: "Doctor not found in auth-service" });
      }
    } catch (error) {
      console.error("❌ Error fetching doctor from auth-service:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Error communicating with auth-service",
      });
    }

    // ✅ Check if already onboarded
    const exists = await DoctorClinic.findOne({
      doctorId: new mongoose.Types.ObjectId(doctor._id),
      clinicId: new mongoose.Types.ObjectId(clinicId),
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Doctor already onboarded in this clinic",
      });
    }

    // ✅ Save doctor-clinic mapping
    const newMapping = new DoctorClinic({
      doctorId: new mongoose.Types.ObjectId(doctor._id),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      roleInClinic: roleInClinic || "consultant",
      status: "active",
      createdBy: createdBy ? new mongoose.Types.ObjectId(createdBy) : undefined,
    });

    await newMapping.save();

    return res.status(201).json({
      success: true,
      message: "Doctor onboarded successfully",
      data: newMapping,
    });
  } catch (error) {
    console.error("❌ Error in onboardDoctor:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
const addDoctorAvailability = async (req, res) => {
  const { id: doctorUniqueId } = req.params; // pass doctorUniqueId instead of Mongo _id
  const { clinicId, daysOfWeek, startTime, endTime, createdBy } = req.body;

  // ✅ Validate clinicId
  if (!mongoose.Types.ObjectId.isValid(clinicId)) {
    return res.status(400).json({ success: false, message: "Invalid clinicId" });
  }

  if (!doctorUniqueId || !daysOfWeek || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    return res.status(400).json({
      success: false,
      message: "doctorUniqueId, daysOfWeek (array), startTime, and endTime are required",
    });
  }

  // ✅ Fetch doctor from auth-service by uniqueId
  let doctor;
  try {
    const url = `${AUTH_SERVICE_BASE_URL}/doctor/details-uniqueid/${doctorUniqueId}`;
    const response = await axios.get(url);

    if (response.data?.success && response.data.doctor) {
      doctor = response.data.doctor;
    } else {
      return res.status(404).json({ success: false, message: "Doctor not found in auth-service" });
    }
  } catch (error) {
    console.error("Axios error fetching doctor:", error.response?.data || error.message);
    return res.status(404).json({
      success: false,
      message: "Failed to fetch doctor from auth-service",
      details: error.response?.data || error.message,
    });
  }

  // ✅ Check if doctor is onboarded in this clinic
  try {
    const onboarded = await DoctorClinic.findOne({
      doctorId: new mongoose.Types.ObjectId(doctor._id),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    });

    if (!onboarded) {
      return res.status(403).json({
        success: false,
        message: "Doctor is not onboarded to this clinic. Please onboard before adding availability.",
      });
    }
  } catch (error) {
    console.error("DB error checking onboard status:", error);
    return res.status(500).json({ success: false, message: "Error checking doctor onboarding" });
  }

  // ✅ Convert times to minutes for overlap check
  const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);

  if (newEnd <= newStart) {
    return res.status(400).json({
      success: false,
      message: "End time must be greater than start time",
    });
  }

  // ✅ Loop through days and create availability
  try {
    const createdSlots = [];
    for (const dayOfWeek of daysOfWeek) {
      // Check overlaps across ALL clinics for that doctor on the same day
      const existingSlots = await DoctorAvailability.find({
        doctorId: new mongoose.Types.ObjectId(doctor._id),
        dayOfWeek,
        isActive: true,
      });

      const hasConflict = existingSlots.some((slot) => {
        const start = toMinutes(slot.startTime);
        const end = toMinutes(slot.endTime);
        return newStart < end && newEnd > start; // ranges overlap
      });

      if (hasConflict) {
        return res.status(400).json({
          success: false,
          message: `Doctor already has an availability overlapping on ${dayOfWeek}`,
        });
      }

      // Save availability
      const availability = new DoctorAvailability({
        doctorId: new mongoose.Types.ObjectId(doctor._id),
        clinicId: new mongoose.Types.ObjectId(clinicId),
        dayOfWeek,
        startTime,
        endTime,
        createdBy: createdBy ? new mongoose.Types.ObjectId(createdBy) : undefined,
      });

      await availability.save();
      createdSlots.push(availability);
    }

    return res.status(201).json({
      success: true,
      message: "Doctor availability added successfully",
      data: createdSlots,
    });
  } catch (error) {
    console.error("DB error saving availability:", error);
    return res.status(500).json({ success: false, message: "Error saving doctor availability" });
  }
};

const getAvailability = async (req, res) => {
  const { doctorId, clinicId, page = 1, limit = 10 } = req.query;

  if (!doctorId && !clinicId) {
    return res.status(400).json({
      success: false,
      message: "Provide either doctorId or clinicId",
    });
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    // CASE 1: Get availability for a specific doctor
    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({ success: false, message: "Invalid doctorId" });
      }

      // Fetch doctor details
      let doctor;
      try {
        const response = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`);
        if (response.data?.success && response.data.doctor) {
          doctor = response.data.doctor;
        } else {
          return res.status(404).json({ success: false, message: "Doctor not found" });
        }
      } catch (err) {
        console.error("Error fetching doctor:", err.response?.data || err.message);
        return res.status(500).json({
          success: false,
          message: "Error fetching doctor details",
          details: err.response?.data || err.message,
        });
      }

      const availabilities = await DoctorAvailability.find({
        doctorId: new mongoose.Types.ObjectId(doctorId),
        isActive: true,
      })
        .skip(skip)
        .limit(Number(limit))
        .select("clinicId dayOfWeek startTime endTime")
        .populate("clinicId", "name address")
        .lean();

      const totalSlots = await DoctorAvailability.countDocuments({
        doctorId: new mongoose.Types.ObjectId(doctorId),
        isActive: true,
      });

      return res.status(200).json({
        success: true,
        type: "doctor",
        doctor,
        totalSlots,
        page: Number(page),
        limit: Number(limit),
        availabilities,
      });
    }

    // CASE 2: Get all availabilities for a clinic
    if (clinicId) {
      if (!mongoose.Types.ObjectId.isValid(clinicId)) {
        return res.status(400).json({ success: false, message: "Invalid clinicId" });
      }

      const availabilities = await DoctorAvailability.find({
        clinicId: new mongoose.Types.ObjectId(clinicId),
        isActive: true,
      })
        .skip(skip)
        .limit(Number(limit))
        .select("doctorId dayOfWeek startTime endTime")
        .lean();

      if (!availabilities.length) {
        return res.status(404).json({
          success: false,
          message: "No availabilities found for this clinic",
        });
      }

      // Fetch doctor details individually
      const data = [];
      for (const av of availabilities) {
        let doctor = null;
        try {
          const response = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${av.doctorId}`);
          if (response.data?.success && response.data.doctor) {
            doctor = response.data.doctor;
          }
        } catch (err) {
          console.error(`Error fetching doctor ${av.doctorId}:`, err.response?.data || err.message);
        }

        data.push({
          ...av,
          doctor: doctor || { _id: av.doctorId, name: "Unknown Doctor" },
        });
      }

      const totalSlots = await DoctorAvailability.countDocuments({
        clinicId: new mongoose.Types.ObjectId(clinicId),
        isActive: true,
      });

      return res.status(200).json({
        success: true,
        type: "clinic",
        clinicId,
        totalSlots,
        page: Number(page),
        limit: Number(limit),
        availabilities: data,
      });
    }
  } catch (error) {
    console.error("DB error fetching availability:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching availability",
      details: error.message,
    });
  }
};




export{onboardDoctor,addDoctorAvailability,getAvailability}
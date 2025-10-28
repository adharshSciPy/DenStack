import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import DoctorClinic from "../model/doctorOnboardingSchema.js";
import DoctorAvailability from "../model/doctorAvailabilitySchema.js";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken'
dotenv.config();

// const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL;
const onboardDoctor = async (req, res) => {
  try {
    const { clinicId, doctorUniqueId, roleInClinic, clinicEmail, clinicPassword, standardConsultationFee,specialization, createdBy } = req.body;

    // Validate required fields
    if (!mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    if (!doctorUniqueId)
      return res.status(400).json({ success: false, message: "doctorUniqueId is required" });
    if (!clinicEmail || !clinicPassword)
      return res.status(400).json({ success: false, message: "Clinic email/password are required" });
    if (!standardConsultationFee || standardConsultationFee < 0)
      return res.status(400).json({ success: false, message: "Invalid standardConsultationFee" });
if (!specialization || !Array.isArray(specialization) || specialization.length === 0) 
      return res.status(400).json({ success: false, message: "At least one specialization is required" });    

    // Fetch doctor from auth-service
    let doctor;
    try {
      const url = `${AUTH_SERVICE_BASE_URL}/doctor/details-uniqueid/${doctorUniqueId}`;
      const response = await axios.get(url);
      if (response.data?.success && response.data.doctor) doctor = response.data.doctor;
      else return res.status(404).json({ success: false, message: "Doctor not found in auth-service" });
    } catch (err) {
      console.error(err.response?.data || err.message);
      return res.status(500).json({ success: false, message: "Error communicating with auth-service" });
    }

    // Check if doctor already onboarded to this clinic
    const exists = await DoctorClinic.findOne({ doctorId: doctor._id, clinicId });
    if (exists) return res.status(400).json({ success: false, message: "Doctor already onboarded in this clinic" });

    // Check if clinic email already exists
    const emailExists = await DoctorClinic.findOne({ "clinicLogin.email": clinicEmail });
    if (emailExists) return res.status(400).json({ success: false, message: "Clinic email already in use" });

    // ✅ Hash the clinic password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(clinicPassword, salt);

    // Create new doctor-clinic mapping with hashed login password
    const newMapping = new DoctorClinic({
      doctorId: doctor._id,
      clinicId,
      roleInClinic: roleInClinic || "consultant",
      clinicLogin: {
        email: clinicEmail,
        password: hashedPassword, // ✅ store only hashed password
      },
      standardConsultationFee,
      specializations: specialization,
      createdBy: createdBy || undefined,
    });

    await newMapping.save();

    res.status(201).json({
      success: true,
      message: "Doctor onboarded successfully with clinic login",
      data: {
        id: newMapping._id,
        doctorId: newMapping.doctorId,
        clinicId: newMapping.clinicId,
        roleInClinic: newMapping.roleInClinic,
        status: newMapping.status,
        specializations: newMapping.specializations,
        standardConsultationFee: newMapping.standardConsultationFee,
        clinicLogin: {
          email: newMapping.clinicLogin.email,
        },
      },
    });

  } catch (error) {
    console.error("❌ Error in onboardDoctor:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const addDoctorAvailability = async (req, res) => {
  const { id: doctorUniqueId } = req.params;
  const { clinicId, availability = [], createdBy } = req.body;

  try {
    // ✅ Validate clinic ID
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    // ✅ Validate inputs
    if (!doctorUniqueId || !Array.isArray(availability) || availability.length === 0) {
      return res.status(400).json({
        success: false,
        message: "doctorUniqueId and non-empty availability[] are required",
      });
    }

    // ✅ Fetch doctor from auth-service
    let doctor;
    try {
      const url = `${AUTH_SERVICE_BASE_URL}/doctor/details-uniqueid/${doctorUniqueId}`;
      const response = await axios.get(url);
      if (response.data?.success && response.data?.doctor) {
        doctor = response.data.doctor;
      } else {
        return res.status(404).json({ success: false, message: "Doctor not found in auth-service" });
      }
    } catch (err) {
      console.error("Error fetching doctor:", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch doctor details from auth-service",
        details: err.message,
      });
    }

    // ✅ Ensure doctor is onboarded in this clinic
    const onboarded = await DoctorClinic.findOne({
      doctorId: new mongoose.Types.ObjectId(doctor._id),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    });
    if (!onboarded) {
      return res.status(403).json({
        success: false,
        message: "Doctor is not onboarded to this clinic.",
      });
    }

    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const createdSlots = [];

    // Helper function to convert time to minutes
    const toMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    // ✅ Fetch all existing availability for doctor across all clinics (once)
    const existingAvailabilities = await DoctorAvailability.find({ doctorId: doctor._id });

    // ✅ Loop through availability slots
    for (const slot of availability) {
      const { dayOfWeek, startTime, endTime } = slot;

      if (!dayOfWeek || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: "Each slot must include dayOfWeek, startTime, and endTime.",
        });
      }

      if (!validDays.includes(dayOfWeek)) {
        return res.status(400).json({
          success: false,
          message: `Invalid day '${dayOfWeek}'. Allowed: ${validDays.join(", ")}`,
        });
      }

      if (toMinutes(endTime) <= toMinutes(startTime)) {
        return res.status(400).json({
          success: false,
          message: `End time must be later than start time for ${dayOfWeek}`,
        });
      }

      // ✅ Check conflicts across all clinics
      let conflictFound = false;
      for (const entry of existingAvailabilities) {
        for (const s of entry.availability) {
          if (s.dayOfWeek !== dayOfWeek || !s.isActive) continue;

          const existingStart = toMinutes(s.startTime);
          const existingEnd = toMinutes(s.endTime);
          const newStart = toMinutes(startTime);
          const newEnd = toMinutes(endTime);

          if (newStart < existingEnd && newEnd > existingStart) {
            const clinicMsg = entry.clinicId.toString() === clinicId
              ? "this clinic"
              : "another clinic";

            return res.status(400).json({
              success: false,
              message: `Doctor already has overlapping availability on ${dayOfWeek} (${s.startTime}–${s.endTime}) in ${clinicMsg}.`,
            });
          }
        }
      }

      // ✅ Add or update doctor availability for this clinic
      let doc = await DoctorAvailability.findOne({
        doctorId: doctor._id,
        clinicId,
      });

      if (!doc) {
        doc = new DoctorAvailability({
          doctorId: doctor._id,
          clinicId,
          createdBy,
          availability: [],
        });
      }

      doc.availability.push({
        dayOfWeek,
        startTime,
        endTime,
        isActive: true,
      });

      await doc.save();
      createdSlots.push({ dayOfWeek, startTime, endTime });
    }

    // ✅ Success response with doctor info
    return res.status(201).json({
      success: true,
      message: "Doctor availability added successfully",
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        phone: doctor.phone,
      },
      availability: createdSlots,
    });
  } catch (error) {
    console.error("❌ addDoctorAvailability error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding doctor availability",
      details: error.message,
    });
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
    // CASE 1 — Fetch by doctorId
    if (doctorId) {
      let doctorDetails = { _id: doctorId, name: "Unknown Doctor" };

      // Fetch doctor details from Auth Service
      try {
        const response = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`);
        if (response.data?.success && response.data?.data) {
          doctorDetails = response.data.data;
        }
      } catch (err) {
        console.warn("Doctor fetch failed:", err.message);
      }

      const records = await DoctorAvailability.find({
        doctorId: new mongoose.Types.ObjectId(doctorId),
      })
        .populate("clinicId", "name address")
        .lean();

      const availabilities = records.flatMap((rec) =>
        (rec.availability || [])
          .filter((a) => a.isActive)
          .map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            isActive: a.isActive,
            clinic: rec.clinicId,
          }))
      );

      return res.status(200).json({
        success: true,
        type: "doctor",
        doctor: doctorDetails,
        totalSlots: availabilities.length,
        availabilities,
      });
    }

    // CASE 2 — Fetch by clinicId
    if (clinicId) {
      const records = await DoctorAvailability.find({
        clinicId: new mongoose.Types.ObjectId(clinicId),
      }).lean();

      // Unique doctorIds
      const doctorIds = [...new Set(records.map((rec) => rec.doctorId.toString()))];

      // Fetch all doctor details in parallel from Auth Service
      const doctorResponses = await Promise.allSettled(
        doctorIds.map((id) => axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${id}`))
      );

      const doctorMap = {};
      doctorResponses.forEach((res, i) => {
        const id = doctorIds[i];
        if (res.status === "fulfilled" && res.value.data?.success && res.value.data.data) {
          doctorMap[id] = res.value.data.data;
        } else {
          doctorMap[id] = { _id: id, name: "Unknown Doctor" };
        }
      });

      // Group availabilities by doctor
      const groupedDoctors = doctorIds.map((id) => {
        const doctorRecords = records.filter((rec) => rec.doctorId.toString() === id);
        const availabilities = doctorRecords.flatMap((rec) =>
          (rec.availability || [])
            .filter((a) => a.isActive)
            .map((a) => ({
              dayOfWeek: a.dayOfWeek,
              startTime: a.startTime,
              endTime: a.endTime,
              isActive: a.isActive,
              clinic: rec.clinicId,
            }))
        );
        return {
          doctor: doctorMap[id],
          availabilities,
        };
      });

      const paginated = groupedDoctors.slice(skip, skip + Number(limit));

      return res.status(200).json({
        success: true,
        type: "clinic",
        clinicId,
        totalDoctors: groupedDoctors.length,
        page: Number(page),
        limit: Number(limit),
        doctors: paginated,
      });
    }
  } catch (error) {
    console.error("❌ Error fetching availability:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching availability",
      details: error.message,
    });
  }
};

const getDoctorsBasedOnDepartment = async (req, res) => {
  const { clinicId, department, page = 1, limit = 10 } = req.query;

  if (!clinicId) {
    return res.status(400).json({ success: false, message: "clinicId is required" });
  }
  if (!mongoose.Types.ObjectId.isValid(clinicId)) {
    return res.status(400).json({ success: false, message: "Invalid clinicId" });
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    // Step 1: Fetch active onboarded doctors from DoctorClinic
    const onboarded = await DoctorClinic.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    })
      .lean();

    if (!onboarded.length) {
      return res.status(404).json({
        success: false,
        message: "No active doctors found for this clinic",
      });
    }

    // Step 2: Fetch doctor details from auth-service
    const doctorPromises = onboarded.map((doc) =>
      axios
        .get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doc.doctorId}`)
        .then((response) => {
          if (response.data?.success && response.data.doctor) {
            return {
              ...doc,
              doctor: response.data.doctor,
            };
          }
          return { ...doc, doctor: null };
        })
        .catch((err) => {
          console.error(`Error fetching doctor ${doc.doctorId}:`, err.message);
          return { ...doc, doctor: null };
        })
    );

    let doctorsWithDetails = await Promise.all(doctorPromises);

    // Step 3: Filter by specialization (department)
    if (department) {
      doctorsWithDetails = doctorsWithDetails.filter(
        (d) => d.doctor && d.doctor.specialization === department
      );
    }

    const totalDoctors = doctorsWithDetails.length;

    // Step 4: Pagination
    const paginatedDoctors = doctorsWithDetails.slice(skip, skip + Number(limit));

    return res.status(200).json({
      success: true,
      clinicId,
      specialization: department || "All",
      totalDoctors,
      page: Number(page),
      limit: Number(limit),
      doctors: paginatedDoctors.map((d) => ({
        doctorId: d.doctorId,
        roleInClinic: d.roleInClinic,
        clinicLogin: { email: d.clinicLogin?.email },
        status: d.status,
        doctor: d.doctor || { _id: d.doctorId, name: "Unknown Doctor" },
      })),
    });
  } catch (error) {
    console.error("Error fetching doctors by department:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching doctors by department",
      details: error.message,
    });
  }
};
const getDoctorsWithAvailability = async (req, res) => {
  try {
    const { clinicId, search = "", page = 1, limit = 10 } = req.query;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "clinicId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    // 1️⃣ Fetch all active doctors for this clinic
    const doctorClinicDocs = await DoctorClinic.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    }).lean();

    if (!doctorClinicDocs.length) {
      return res.status(404).json({ success: false, message: "No active doctors found for this clinic" });
    }

    // 2️⃣ Fetch all doctor details from Auth service (before filtering)
    const doctorDetailsMap = {};
    await Promise.all(
      doctorClinicDocs.map(async (docClinic) => {
        const doctorId = docClinic.doctorId.toString();
        try {
          const doctorRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`);
          doctorDetailsMap[doctorId] =
            doctorRes.data?.success && doctorRes.data?.data
              ? doctorRes.data.data
              : null;
        } catch (err) {
          console.error(`Error fetching doctor ${doctorId}:`, err.message);
          doctorDetailsMap[doctorId] = null;
        }
      })
    );

    // 3️⃣ Combine and filter using unified search
    let filteredDocs = doctorClinicDocs;

    if (search.trim()) {
      const searchTerm = search.toLowerCase();

      filteredDocs = doctorClinicDocs.filter((docClinic) => {
        const doctorId = docClinic.doctorId.toString();
        const doctorDetails = doctorDetailsMap[doctorId];

        const matchesClinic = [
          docClinic.uniqueId,
          ...(docClinic.specializations || []),
        ].some((field) => field?.toLowerCase().includes(searchTerm));

        const matchesDoctor =
          doctorDetails &&
          [
            doctorDetails.name,
            doctorDetails.uniqueId,
            doctorDetails.email,
            doctorDetails.specialization,
          ].some((field) => field?.toLowerCase().includes(searchTerm));

        return matchesClinic || matchesDoctor;
      });
    }

    if (!filteredDocs.length) {
      return res.status(404).json({
        success: false,
        message: "No doctors found matching the search criteria",
      });
    }

    const totalDoctors = filteredDocs.length;
    const paginatedDocs = filteredDocs.slice(skip, skip + parsedLimit);
    const paginatedDoctorIds = paginatedDocs.map((d) => d.doctorId.toString());

    // 4️⃣ Fetch availabilities
    const allAvailabilities = await DoctorAvailability.find({
      doctorId: { $in: paginatedDoctorIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .populate("clinicId", "name address")
      .lean();

    // 5️⃣ Combine everything
    const doctors = paginatedDocs.map((docClinic) => {
      const id = docClinic.doctorId.toString();
      const doctorDetails = doctorDetailsMap[id];
      const availabilities = allAvailabilities
        .filter((a) => a.doctorId.toString() === id)
        .flatMap((rec) =>
          (rec.availability || [])
            .filter((a) => a.isActive)
            .map((a) => ({
              dayOfWeek: a.dayOfWeek,
              startTime: a.startTime,
              endTime: a.endTime,
              isActive: a.isActive,
              clinic: rec.clinicId,
            }))
        );

      return {
        doctorId: id,
        roleInClinic: docClinic.roleInClinic,
        clinicLogin: { email: docClinic.clinicLogin?.email },
        status: docClinic.status,
        specialization: docClinic.specializations,
        standardConsultationFee: docClinic.standardConsultationFee,
        doctor: doctorDetails || { _id: id, name: "Unknown Doctor" },
        availability: availabilities,
      };
    });

    const totalPages = Math.ceil(totalDoctors / parsedLimit);

    return res.status(200).json({
      success: true,
      clinicId,
      totalDoctors,
      page: parseInt(page, 10),
      totalPages,
      limit: parsedLimit,
      search,
      doctors,
    });
  } catch (err) {
    console.error("Error fetching doctors with availability:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching doctors with availability",
      details: err.message,
    });
  }
};


const getAllActiveDoctorsOnClinic = async (req, res) => {
  const { clinicId, page = 1, limit = 10 } = req.query;

  // 🧩 Validate clinicId
  if (!clinicId) {
    return res.status(400).json({ success: false, message: "clinicId is required" });
  }
  if (!mongoose.Types.ObjectId.isValid(clinicId)) {
    return res.status(400).json({ success: false, message: "Invalid clinicId" });
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    // 1️⃣ Fetch active onboarded doctors for clinic
    const onboarded = await DoctorClinic.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    if (!onboarded.length) {
      return res.status(200).json({
        success: true,
        clinicId,
        totalDoctors: 0,
        doctors: [],
        message: "No active doctors found for this clinic",
      });
    }

    // 2️⃣ Count total doctors (for pagination)
    const totalDoctors = await DoctorClinic.countDocuments({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    });

    // 3️⃣ Fetch doctor details from AUTH service (parallel + fallback)
    const doctorPromises = onboarded.map(async (doc) => {
      try {
        const response = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doc.doctorId}`);
        const doctorData = response.data?.data || { _id: doc.doctorId, name: "Unknown Doctor" };

        return {
          ...doc,
          doctor: {
            _id: doctorData._id,
            name: doctorData.name,
            email: doctorData.email,
            phoneNumber: doctorData.phoneNumber,
            specialization: doctorData.specialization,
            licenseNumber: doctorData.licenseNumber,
            approve: doctorData.approve,
            uniqueId: doctorData.uniqueId,
          },
        };
      } catch (err) {
        console.error(`Error fetching doctor ${doc.doctorId}:`, err.message);
        return {
          ...doc,
          doctor: { _id: doc.doctorId, name: "Unknown Doctor" },
        };
      }
    });

    const doctorsWithDetails = await Promise.all(doctorPromises);

    // 4️⃣ Return response
    return res.status(200).json({
      success: true,
      clinicId,
      totalDoctors,
      page: Number(page),
      limit: Number(limit),
      doctors: doctorsWithDetails.map((d) => ({
        doctorId: d.doctorId,
        roleInClinic: d.roleInClinic,
        clinicLogin: { email: d.clinicLogin?.email },
        status: d.status,
        standardConsultationFee: d.standardConsultationFee,
        doctor: d.doctor,
      })),
    });
  } catch (error) {
    console.error("Error fetching active doctors:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching active doctors for clinic",
      details: error.message,
    });
  }
};
const clinicDoctorLogin = async (req, res) => {
  const { clinicEmail, clinicPassword,clinicId } = req.body;

  try {
    // ✅ Validate input
    if (!clinicEmail || !clinicPassword || !clinicId) {
      return res.status(400).json({ success: false, message: "Email, password, and clinicId are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

  
    const doctorClinic = await DoctorClinic.findOne({ "clinicLogin.email": clinicEmail });

    if (!doctorClinic) {
      return res.status(404).json({ success: false, message: "Invalid email or password" });
    }

    
    const isMatch = await bcrypt.compare(clinicPassword, doctorClinic.clinicLogin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    if(doctorClinic.clinicId.toString()!==clinicId){
      return res.status(403).json({ success: false, message: "Doctor not associated with this clinic" });
    }

    // ✅ Generate JWT
  const accessToken = jwt.sign(
  {
    doctorClinicId: doctorClinic._id,
    doctorId: doctorClinic.doctorId,
    clinicId: doctorClinic.clinicId,
    roleInClinic: doctorClinic.roleInClinic,
  },
  process.env.ACCESS_TOKEN_SECRET,   // ✅ fixed
  { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" }
);

const refreshToken = jwt.sign(
  { doctorClinicId: doctorClinic._id },
  process.env.REFRESH_TOKEN_SECRET,  // ✅ fixed
  { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
);


    return res.status(200).json({
      success: true,
      message: "Login successful inside clinic",
      doctorClinic: {
        id: doctorClinic._id,
        roleInClinic: doctorClinic.roleInClinic,
        status: doctorClinic.status,
        doctor: {
          id: doctorClinic.doctorId._id,
          name: doctorClinic.doctorId.name,
        },
        clinic: {
          id: doctorClinic.clinicId._id,
          name: doctorClinic.clinicId.name,
        },
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in clinicDoctorLogin:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeDoctorFromClinic = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.body;

    // ✅ Validate inputs
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctorId" });
    }

    // ✅ Check mapping
    const mapping = await DoctorClinic.findOne({ clinicId, doctorId });
    if (!mapping) {
      return res.status(404).json({ success: false, message: "Doctor not onboarded in this clinic" });
    }

    // ✅ Delete doctor-clinic record
    await DoctorClinic.findByIdAndDelete(mapping._id);

    // ✅ Call Appointment Service to clear doctor references
    let updatedAppointments = [];
    try {
      const response = await axios.put(`${PATIENT_SERVICE_BASE_URL}/appointment/clear-doctor-from-appointments`, {
        clinicId,
        doctorId,
      });
      updatedAppointments = response.data?.updatedAppointments || [];
    } catch (err) {
      console.error("❌ Error updating appointments:", err.response?.data || err.message);
    }

    // ✅ Respond
    return res.status(200).json({
      success: true,
      message: "Doctor removed from clinic successfully",
      deletedMappingId: mapping._id,
      affectedAppointments: updatedAppointments.length,
      updatedAppointments,
    });
  } catch (error) {
    console.error("❌ removeDoctorFromClinic error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing doctor from clinic",
      error: error.message,
    });
  }
};
const getSingleDoctorWithinClinic = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;

    // ✅ Validate IDs
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: "Invalid doctorId" });

    // ✅ Fetch the DoctorClinic entry
    const doctorClinic = await DoctorClinic.findOne({ clinicId, doctorId }).lean();

    if (!doctorClinic)
      return res.status(404).json({ success: false, message: "Doctor not found in this clinic" });

    // ✅ Fetch doctor's basic info from Auth Service
    const doctorRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`);
    const doctorData = doctorRes.data?.data;

    if (!doctorData)
      return res.status(404).json({ success: false, message: "Doctor details not found in Auth Service" });

    // ✅ Fetch all doctor availabilities for this clinic
    const availabilities = await DoctorAvailability.find({ clinicId, doctorId })
      .select("dayOfWeek startTime endTime isActive _id createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Combine data
    const responseData = {
      ...doctorClinic,
      name: doctorData.name,
      specialization: doctorData.specialization || null,
      email: doctorData.email || null,
      phone: doctorData.phone || null,
      availability: availabilities,
    };

    return res.status(200).json({
      success: true,
      message: "Doctor and availability details fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("❌ getSingleDoctorWithinClinic error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching doctor details",
      error: error.message,
    });
  }
};
const editDoctorAvailability = async (req, res) => {
  try {
    const { id: availabilityId } = req.params; // DoctorAvailability document _id
    const { index, dayOfWeek, startTime, endTime, updatedBy } = req.body;

    // ✅ Validate index
    if (index === undefined || index === null) {
      return res.status(400).json({ success: false, message: "Availability index is required" });
    }

    // ✅ Convert time to minutes
    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Both startTime and endTime are required",
      });
    }

    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);

    if (newEnd <= newStart) {
      return res.status(400).json({
        success: false,
        message: "End time must be later than start time",
      });
    }

    // ✅ Fetch the document
    const availabilityDoc = await DoctorAvailability.findById(availabilityId);
    if (!availabilityDoc) {
      return res.status(404).json({
        success: false,
        message: "Doctor availability document not found",
      });
    }

    // ✅ Validate index range
    if (index < 0 || index >= availabilityDoc.availability.length) {
      return res.status(400).json({ success: false, message: "Invalid availability index" });
    }

    const targetSlot = availabilityDoc.availability[index];
    const newDay = dayOfWeek || targetSlot.dayOfWeek;

    // ✅ Fetch all existing availabilities for this doctor
    const existingAvailabilities = await DoctorAvailability.find({
      doctorId: availabilityDoc.doctorId,
    });

    // ✅ Check conflicts across all clinics
    for (const entry of existingAvailabilities) {
      for (const [i, s] of entry.availability.entries()) {
        if (entry._id.toString() === availabilityDoc._id.toString() && i === index) continue; // skip current slot
        if (s.dayOfWeek !== newDay || !s.isActive) continue;

        const existingStart = toMinutes(s.startTime);
        const existingEnd = toMinutes(s.endTime);

        if (newStart < existingEnd && newEnd > existingStart) {
          const clinicMsg =
            entry.clinicId.toString() === availabilityDoc.clinicId.toString()
              ? "this clinic"
              : "another clinic";

          return res.status(400).json({
            success: false,
            message: `Doctor already has overlapping availability on ${newDay} (${s.startTime}–${s.endTime}) in ${clinicMsg}.`,
          });
        }
      }
    }

    // ✅ Update the specific entry
    targetSlot.dayOfWeek = newDay;
    targetSlot.startTime = startTime;
    targetSlot.endTime = endTime;
    targetSlot.updatedBy = updatedBy || null;
    availabilityDoc.updatedAt = new Date();

    await availabilityDoc.save();

    // ✅ Optionally re-fetch to confirm changes
    const updatedDoc = await DoctorAvailability.findById(availabilityId);

    res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data: updatedDoc,
    });
  } catch (err) {
    console.error("❌ editDoctorAvailability error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating doctor availability",
      details: err.message,
    });
  }
};
const getDepartmentDetails = async (req, res) => {
  try {
    const { id: clinicId } = req.params;

    // 🔹 Validate clinicId
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clinicId",
      });
    }

    // 🔹 Find all active doctors in the clinic
    const onboardedDoctors = await DoctorClinic.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    })
      .select("specializations")
      .lean();

    if (!onboardedDoctors.length) {
      return res.status(404).json({
        success: false,
        message: "No doctors found for this clinic",
        departments: [],
      });
    }

    // 🔹 Collect and flatten all specialization arrays
    const allSpecializations = onboardedDoctors.flatMap(
      (doc) => doc.specializations || []
    );

    // 🔹 Extract unique departments (remove duplicates)
    const departments = [...new Set(allSpecializations.filter(Boolean))];

    // 🔹 If no departments found
    if (!departments.length) {
      return res.status(404).json({
        success: false,
        message: "No departments found for this clinic",
        departments: [],
      });
    }

    // ✅ Success response
    return res.status(200).json({
      success: true,
      clinicId,
      totalDepartments: departments.length,
      departments,
    });
  } catch (error) {
    console.error("Error fetching department details:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching department details",
      details: error.message,
    });
  }
};





export { onboardDoctor, addDoctorAvailability, getAvailability, clinicDoctorLogin, getDoctorsBasedOnDepartment, getDoctorsWithAvailability, getAllActiveDoctorsOnClinic, removeDoctorFromClinic, getSingleDoctorWithinClinic, editDoctorAvailability, getDepartmentDetails };
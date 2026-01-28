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
    const { clinicId, doctorUniqueId, roleInClinic, standardConsultationFee, specialization, createdBy } = req.body;

    // ===== Validations =====
    if (!mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });

    if (!doctorUniqueId)
      return res.status(400).json({ success: false, message: "doctorUniqueId is required" });

    if (!standardConsultationFee || standardConsultationFee < 0)
      return res.status(400).json({ success: false, message: "Invalid standardConsultationFee" });

    if (!specialization || !Array.isArray(specialization) || specialization.length === 0)
      return res.status(400).json({ success: false, message: "At least one specialization is required" });

    // ===== Fetch doctor from auth-service =====
    let doctor;
    try {
      const url = `${AUTH_SERVICE_BASE_URL}/doctor/details-uniqueid/${doctorUniqueId}`;
      const response = await axios.get(url);
      if (response.data?.success && response.data.doctor) {
        doctor = response.data.doctor;
      } else {
        return res.status(404).json({ success: false, message: "Doctor not found in auth-service" });
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      return res.status(500).json({ success: false, message: "Error communicating with auth-service" });
    }

    // ===== Prevent duplicate onboarding =====
    const exists = await DoctorClinic.findOne({ doctorId: doctor._id, clinicId });
    if (exists)
      return res.status(400).json({ success: false, message: "Doctor already onboarded in this clinic" });

    // ===== Create new doctor-clinic mapping =====
    const newMapping = new DoctorClinic({
      doctorId: doctor._id,
      clinicId,
      roleInClinic: roleInClinic || "consultant",
      standardConsultationFee,
      specializations: specialization,
      createdBy: createdBy || undefined,
    });

    await newMapping.save();

    // ✅ NEW: Update doctor status in auth service
    try {
      await axios.put(`${AUTH_SERVICE_BASE_URL}/doctor/update-clinic-status`, {
        doctorId: doctor._id,
        clinicId,
        action: 'onboard'
      });
    } catch (authError) {
      console.error("⚠️ Error updating doctor clinic status:", authError.response?.data || authError.message);
      // Continue even if this fails - the onboarding is still valid
    }

    res.status(201).json({
      success: true,
      message: "Doctor onboarded successfully to clinic",
      data: {
        id: newMapping._id,
        doctorId: newMapping.doctorId,
        clinicId: newMapping.clinicId,
        roleInClinic: newMapping.roleInClinic,
        status: newMapping.status,
        specializations: newMapping.specializations,
        standardConsultationFee: newMapping.standardConsultationFee,
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
    // ===== Validations =====
    if (!mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });

    if (!doctorUniqueId || !Array.isArray(availability) || availability.length === 0)
      return res.status(400).json({
        success: false,
        message: "doctorUniqueId and non-empty availability[] are required",
      });

    // ===== Fetch doctor =====
    let doctor;
    const url = `${AUTH_SERVICE_BASE_URL}/doctor/details-uniqueid/${doctorUniqueId}`;
    const response = await axios.get(url);
    if (response.data?.success && response.data?.doctor) {
      doctor = response.data.doctor;
    } else {
      return res.status(404).json({ success: false, message: "Doctor not found in auth-service" });
    }

    // ===== Ensure doctor onboarded =====
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
    const toMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    // ===== Get existing availabilities =====
    const existingAvailabilities = await DoctorAvailability.find({ doctorId: doctor._id });

    // ===== Phase 1: Validate all slots =====
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

      // Check conflicts
      for (const entry of existingAvailabilities) {
        for (const s of entry.availability) {
          if (s.dayOfWeek !== dayOfWeek || !s.isActive) continue;

          const existingStart = toMinutes(s.startTime);
          const existingEnd = toMinutes(s.endTime);
          const newStart = toMinutes(startTime);
          const newEnd = toMinutes(endTime);

          if (newStart < existingEnd && newEnd > existingStart) {
            const clinicMsg =
              entry.clinicId.toString() === clinicId ? "this clinic" : "another clinic";
            return res.status(400).json({
              success: false,
              message: `Doctor already has overlapping availability on ${dayOfWeek} (${s.startTime}–${s.endTime}) in ${clinicMsg}.`,
            });
          }
        }
      }
    }

    // ===== Phase 2: Perform the write once all validations pass =====
    let doc = await DoctorAvailability.findOne({ doctorId: doctor._id, clinicId });

    if (!doc) {
      doc = new DoctorAvailability({
        doctorId: doctor._id,
        clinicId,
        createdBy,
        availability: [],
      });
    }

    // Add all validated slots in one go
    doc.availability.push(
      ...availability.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: true,
      }))
    );

    await doc.save();

    // ===== Response =====
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
      availability,
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
    // ============================
    // FETCH BY DOCTOR
    // ============================
    if (doctorId) {
      const records = await DoctorAvailability.find({
        doctorId: new mongoose.Types.ObjectId(doctorId),
      })
        .populate("clinicId", "name address")
        .lean();

      const normalizeTime = (t) => t.length === 4 ? "0" + t : t;

      const availabilities = records.flatMap((rec) =>
        rec.availability
          .filter((a) => a.isActive)
          .map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: normalizeTime(a.startTime),
            endTime: normalizeTime(a.endTime),
            clinic: rec.clinicId,
          }))
      );

      return res.status(200).json({
        success: true,
        doctorId,
        totalSlots: availabilities.length,
        availabilities,
      });
    }

    // ============================
    // FETCH BY CLINIC
    // ============================
    if (clinicId) {
      const records = await DoctorAvailability.find({
        clinicId: new mongoose.Types.ObjectId(clinicId),
      }).lean();

      const normalizeTime = (t) => t.length === 4 ? "0" + t : t;

      const grouped = {};

      for (const rec of records) {
        const id = rec.doctorId.toString();
        if (!grouped[id]) grouped[id] = [];

        rec.availability
          .filter((a) => a.isActive)
          .forEach((a) => {
            grouped[id].push({
              dayOfWeek: a.dayOfWeek,
              startTime: normalizeTime(a.startTime),
              endTime: normalizeTime(a.endTime),
            });
          });
      }

      const list = Object.entries(grouped).map(([doctorId, avail]) => ({
        doctorId,
        availabilities: avail,
      }));

      return res.status(200).json({
        success: true,
        clinicId,
        totalDoctors: list.length,
        doctors: list.slice(skip, skip + Number(limit)),
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
    const {
      clinicId,
      search = "",
      department = "",
      page = 1,
      limit = 10,
    } = req.query;

    // -------------------------------
    // 1️⃣ VALIDATION
    // -------------------------------
    if (!clinicId) {
      return res.status(400).json({ success: false, message: "clinicId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const skip = (parseInt(page) - 1) * parsedLimit;

    // -------------------------------
    // 2️⃣ FETCH ALL ACTIVE DOCTOR-CLINIC LINKS
    // -------------------------------
    const doctorClinicDocs = await DoctorClinic.find({
      clinicId,
      status: "active",
    }).lean();

    if (!doctorClinicDocs.length) {
      return res.status(404).json({
        success: false,
        message: "No active doctors found for this clinic",
      });
    }

    // -------------------------------
    // 3️⃣ DEPARTMENT FILTER (PRIMARY FILTER)
    // -------------------------------
  let filteredDocs = doctorClinicDocs;

if (department.trim()) {
  const depLower = department.trim().toLowerCase();

  filteredDocs = doctorClinicDocs.filter((docClinic) => {
    const specs = docClinic.specializations;

    // If no specializations, skip
    if (!Array.isArray(specs) || specs.length === 0) return false;

    return specs.some(
      (spec) => typeof spec === "string" && spec.trim().toLowerCase() === depLower
    );
  });

  if (!filteredDocs.length) {
    return res.status(404).json({
      success: false,
      message: `No doctors found for specialization '${department}'`,
    });
  }
}

    // -------------------------------
    // 4️⃣ FETCH DOCTOR DETAILS (ONLY FOR FILTERED SET)
    // -------------------------------
    const doctorDetailsMap = {};

    await Promise.all(
      filteredDocs.map(async (docClinic) => {
        const doctorId = docClinic.doctorId.toString();

        try {
          const doctorRes = await axios.get(
            `${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`
          );

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

    // -------------------------------
    // 5️⃣ SEARCH FILTER (SECONDARY FILTER)
    // -------------------------------
    if (search.trim()) {
      const searchTerm = search.toLowerCase();

      filteredDocs = filteredDocs.filter((docClinic) => {
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

      if (!filteredDocs.length) {
        return res.status(404).json({
          success: false,
          message: "No doctors found matching the search criteria",
        });
      }
    }

    // -------------------------------
    // 6️⃣ PAGINATION
    // -------------------------------
    const totalDoctors = filteredDocs.length;
    const paginatedDocs = filteredDocs.slice(skip, skip + parsedLimit);

    const paginatedDoctorIds = paginatedDocs.map((d) =>
      d.doctorId.toString()
    );

    // -------------------------------
    // 7️⃣ FETCH AVAILABILITIES
    // -------------------------------
    const allAvailabilities = await DoctorAvailability.find({
      doctorId: { $in: paginatedDoctorIds },
      clinicId,
    })
      .populate("clinicId", "name address")
      .lean();

    // -------------------------------
    // 8️⃣ COMBINE ALL DATA
    // -------------------------------
    const doctors = paginatedDocs.map((docClinic) => {
      const id = docClinic.doctorId.toString();
      const doctorDetails = doctorDetailsMap[id];

 const availabilities = allAvailabilities
  .filter((rec) => {
    const recClinic = rec.clinicId?._id?.toString() || rec.clinicId?.toString();
    const matchClinic = recClinic === clinicId;
    return rec.doctorId.toString() === id && matchClinic;
  })
  .flatMap((rec) =>
    (rec.availability || [])
      .filter((slot) => slot.isActive)
      .map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: slot.isActive,
        clinicId: clinicId,
         availabilityId: rec._id,
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

    // -------------------------------
    // 9️⃣ RESPONSE
    // -------------------------------
    return res.status(200).json({
      success: true,
      clinicId,
      department,
      search,
      totalDoctors,
      page: parseInt(page),
      totalPages,
      limit: parsedLimit,
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
// OLD CODE - kept for reference(not used,doctor clinic login,passing clinicId from frontend)
// const clinicDoctorLogin = async (req, res) => {
//   const { clinicEmail, clinicPassword,clinicId } = req.body;

//   try {
//     // ✅ Validate input
//     if (!clinicEmail || !clinicPassword || !clinicId) {
//       return res.status(400).json({ success: false, message: "Email, password, and clinicId are required" });
//     }
//     if (!mongoose.Types.ObjectId.isValid(clinicId)) {
//       return res.status(400).json({ success: false, message: "Invalid clinicId" });
//     }

  
//     const doctorClinic = await DoctorClinic.findOne({ "clinicLogin.email": clinicEmail });

//     if (!doctorClinic) {
//       return res.status(404).json({ success: false, message: "Invalid email or password" });
//     }

    
//     const isMatch = await bcrypt.compare(clinicPassword, doctorClinic.clinicLogin.password);
//     if (!isMatch) {
//       return res.status(401).json({ success: false, message: "Invalid email or password" });
//     }
//     if(doctorClinic.clinicId.toString()!==clinicId){
//       return res.status(403).json({ success: false, message: "Doctor not associated with this clinic" });
//     }

//     // ✅ Generate JWT
//   const accessToken = jwt.sign(
//   {
//     doctorClinicId: doctorClinic._id,
//     doctorId: doctorClinic.doctorId,
//     clinicId: doctorClinic.clinicId,
//     roleInClinic: doctorClinic.roleInClinic,
//   },
//   process.env.ACCESS_TOKEN_SECRET,   // ✅ fixed
//   { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" }
// );

// const refreshToken = jwt.sign(
//   { doctorClinicId: doctorClinic._id },
//   process.env.REFRESH_TOKEN_SECRET,  // ✅ fixed
//   { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
// );


//     return res.status(200).json({
//       success: true,
//       message: "Login successful inside clinic",
//       doctorClinic: {
//         id: doctorClinic._id,
//         roleInClinic: doctorClinic.roleInClinic,
//         status: doctorClinic.status,
//         doctor: {
//           id: doctorClinic.doctorId._id,
//           name: doctorClinic.doctorId.name,
//         },
//         clinic: {
//           id: doctorClinic.clinicId._id,
//           name: doctorClinic.clinicId.name,
//         },
//       },
//       accessToken,
//       refreshToken,
//     });
//   } catch (error) {
//     console.error("❌ Error in clinicDoctorLogin:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// NEW CODE - clinic doctor login(used,by fetching clinicId from db itself)
const clinicDoctorLogin = async (req, res) => {
  const { clinicEmail, clinicPassword } = req.body;

  try {
    // ✅ Validate input
    if (!clinicEmail || !clinicPassword) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // ✅ Find the doctor/staff by login email
    const doctorClinic = await DoctorClinic.findOne({ "clinicLogin.email": clinicEmail })
    
    if (!doctorClinic) {
      return res.status(404).json({ success: false, message: "Invalid email or password" });
    }

    // ✅ Verify password
    const isMatch = await bcrypt.compare(clinicPassword, doctorClinic.clinicLogin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // ✅ Generate JWT tokens
    const accessToken = jwt.sign(
      {
        doctorClinicId: doctorClinic._id,
        doctorId: doctorClinic.doctorId._id,
        clinicId: doctorClinic.clinicId._id,   // automatically from DB
         role: process.env.DOCTOR_CLINIC_ROLE || "456", 
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" }
    );

    const refreshToken = jwt.sign(
      { doctorClinicId: doctorClinic._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
    );

    // ✅ Send response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      doctorClinic: {
        id: doctorClinic._id,
        roleInClinic: doctorClinic.roleInClinic,
        role: process.env.DOCTOR_CLINIC_ROLE || "456", 
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

    // ✅✅✅ Update doctor status in Auth Service ✅✅✅
    try {
      const updateUrl = `${AUTH_SERVICE_BASE_URL}/doctor/update-clinic-status`;
      await axios.put(updateUrl, {
        doctorId,
        clinicId,
        action: 'remove'
      });
      console.log("✅ Doctor status updated in Auth Service");
    } catch (authError) {
      console.error("⚠️ Error updating doctor clinic status:", authError.response?.data || authError.message);
    }

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
  const { id: availabilityId } = req.params;
  const { clinicId, availability = [], updatedBy } = req.body;

  console.log("==== editDoctorAvailability called ====");
  console.log("Params:", req.params);
  console.log("Body:", req.body);

  try {
    // ===== Basic validations =====
    if (!availabilityId) {
      console.log("❌ No availabilityId provided");
      return res.status(400).json({ success: false, message: "Availability ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      console.log("❌ Invalid clinicId:", clinicId);
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    if (!Array.isArray(availability) || availability.length === 0) {
      console.log("❌ Empty availability array");
      return res.status(400).json({ success: false, message: "Non-empty availability[] is required" });
    }

    // ===== Fetch existing availability document =====
    const availabilityDoc = await DoctorAvailability.findOne({ _id: availabilityId, clinicId });
    console.log("Fetched availabilityDoc:", availabilityDoc);
    if (!availabilityDoc) {
      console.log("❌ Doctor availability not found");
      return res.status(404).json({ success: false, message: "Doctor availability not found" });
    }

    // ===== Ensure doctor is onboarded =====
    const onboarded = await DoctorClinic.findOne({
      doctorId: availabilityDoc.doctorId,
      clinicId,
      status: "active",
    });
    console.log("Doctor onboarded check:", onboarded);
    if (!onboarded) {
      console.log("❌ Doctor is not onboarded to this clinic");
      return res.status(403).json({ success: false, message: "Doctor is not onboarded to this clinic" });
    }

    const toMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const validDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    // ===== Phase 1: Validate new slots =====
    for (const slot of availability) {
      console.log("Validating slot:", slot);
      const { dayOfWeek, startTime, endTime } = slot;

      if (!dayOfWeek || !startTime || !endTime) {
        console.log("❌ Slot missing fields:", slot);
        return res.status(400).json({ success: false, message: "Each slot must include dayOfWeek, startTime, endTime" });
      }

      if (!validDays.includes(dayOfWeek)) {
        console.log("❌ Invalid day:", dayOfWeek);
        return res.status(400).json({ success: false, message: `Invalid day '${dayOfWeek}'. Allowed: ${validDays.join(", ")}` });
      }

      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        console.log("❌ Invalid time format:", startTime, endTime);
        return res.status(400).json({ success: false, message: "StartTime and EndTime must be in HH:mm format" });
      }

      if (toMinutes(endTime) <= toMinutes(startTime)) {
        console.log("❌ End time <= start time:", slot);
        return res.status(400).json({ success: false, message: `End time must be later than start time for ${dayOfWeek}` });
      }
    }

    // ===== Phase 2: Check conflicts within new slots =====
    const byDay = {};
    for (const slot of availability) {
      if (!byDay[slot.dayOfWeek]) byDay[slot.dayOfWeek] = [];
      byDay[slot.dayOfWeek].push(slot);
    }

    for (const day in byDay) {
      const slots = byDay[day].sort((a,b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      console.log(`Checking conflicts for day: ${day}`, slots);
      for (let i = 0; i < slots.length - 1; i++) {
        if (toMinutes(slots[i+1].startTime) < toMinutes(slots[i].endTime)) {
          console.log("❌ Overlap detected:", slots[i], slots[i+1]);
          return res.status(400).json({ success: false, message: `Conflict on ${day}: overlapping (${slots[i].startTime}-${slots[i].endTime}) and (${slots[i+1].startTime}-${slots[i+1].endTime})` });
        }
      }
    }

    // ===== Phase 3: Check conflicts with other clinics =====
    const otherClinics = await DoctorAvailability.find({
      doctorId: availabilityDoc.doctorId,
      _id: { $ne: availabilityId },
    });
    console.log("Other clinic availabilities:", otherClinics);

    for (const newSlot of availability) {
      const newStart = toMinutes(newSlot.startTime);
      const newEnd = toMinutes(newSlot.endTime);

      for (const entry of otherClinics) {
        console.log("Checking against other clinic entry:", entry);
        for (const s of entry.availability) {
          console.log("Existing slot:", s);
          if (!s.isActive || s.dayOfWeek !== newSlot.dayOfWeek) continue;

          const existingStart = toMinutes(s.startTime);
          const existingEnd = toMinutes(s.endTime);

          if (newStart < existingEnd && newEnd > existingStart) {
            const clinicMsg = entry.clinicId.toString() === clinicId ? "this clinic" : "another clinic";
            console.log(`❌ Overlap with other clinic (${clinicMsg}):`, s);
            return res.status(400).json({
              success: false,
              message: `Doctor already has overlapping availability on ${newSlot.dayOfWeek} (${s.startTime}-${s.endTime}) in ${clinicMsg}.`,
            });
          }
        }
      }
    }

    // ===== Phase 4: Replace availability array =====
    console.log("Updating availabilityDoc with new slots...");
    availabilityDoc.availability = availability.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime.length === 4 ? "0"+slot.startTime : slot.startTime,
      endTime: slot.endTime.length === 4 ? "0"+slot.endTime : slot.endTime,
      isActive: true,
     
    }));

    // ===== UpdatedBy handling =====
    console.log("Raw updatedBy:", updatedBy);
    if (updatedBy && mongoose.Types.ObjectId.isValid(updatedBy)) {
     availabilityDoc.updatedBy = typeof updatedBy === "string" 
  ? new mongoose.Types.ObjectId(updatedBy)
  : updatedBy;

      console.log("Assigned updatedBy ObjectId:", availabilityDoc.updatedBy);
    } else {
      console.log("Invalid updatedBy value, skipping assignment");
      availabilityDoc.updatedBy = undefined;
    }

    const savedDoc = await availabilityDoc.save();
    console.log("Saved availabilityDoc:", savedDoc);

    return res.status(200).json({
      success: true,
      message: "Doctor availability updated successfully",
      availability: savedDoc.availability,
    });

  } catch (err) {
    console.error("❌ editDoctorAvailability error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while updating availability",
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
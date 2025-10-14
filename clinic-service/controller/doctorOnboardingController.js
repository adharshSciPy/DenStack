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

const onboardDoctor = async (req, res) => {
  try {
    const { clinicId, doctorUniqueId, roleInClinic, clinicEmail, clinicPassword, standardConsultationFee, createdBy } = req.body;

    // Validate required fields
    if (!mongoose.Types.ObjectId.isValid(clinicId))
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    if (!doctorUniqueId)
      return res.status(400).json({ success: false, message: "doctorUniqueId is required" });
    if (!clinicEmail || !clinicPassword)
      return res.status(400).json({ success: false, message: "Clinic email/password are required" });
    if (!standardConsultationFee || standardConsultationFee < 0)
      return res.status(400).json({ success: false, message: "Invalid standardConsultationFee" });

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
  const { id: doctorUniqueId } = req.params; // doctorUniqueId from URL
  const { clinicId, daysOfWeek, startTime, endTime, createdBy } = req.body;

  // ✅ Validate input
  if (!mongoose.Types.ObjectId.isValid(clinicId)) {
    return res.status(400).json({ success: false, message: "Invalid clinicId" });
  }
  if (!doctorUniqueId || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    return res.status(400).json({
      success: false,
      message: "doctorUniqueId, daysOfWeek[], startTime, and endTime are required",
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
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctor from auth-service",
      details: error.response?.data || error.message,
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
      message: "Doctor is not onboarded to this clinic. Please onboard before adding availability.",
    });
  }

  // ✅ Time overlap helper
  const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);

  if (newEnd <= newStart) {
    return res.status(400).json({
      success: false,
      message: "End time must be later than start time",
    });
  }

  try {
    const createdSlots = [];

    for (const dayOfWeek of daysOfWeek) {
      // ✅ Find all slots for this doctor on this day (across ALL clinics)
      const existingSlots = await DoctorAvailability.find({
        doctorId: doctor._id,
        dayOfWeek,
        isActive: true,
      });

      // ✅ Check overlap with each existing slot
      const hasConflict = existingSlots.some((slot) => {
        const start = toMinutes(slot.startTime);
        const end = toMinutes(slot.endTime);
        return newStart < end && newEnd > start; // ranges overlap
      });

      if (hasConflict) {
        return res.status(400).json({
          success: false,
          message: `Doctor already has availability overlapping on ${dayOfWeek} (${startTime} - ${endTime}) in another clinic`,
        });
      }

      // ✅ If no conflict, create availability
      const availability = new DoctorAvailability({
        doctorId: doctor._id,
        clinicId,
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
    const { clinicId, department, page = 1, limit = 10 } = req.query;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "clinicId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    // 1️⃣ Fetch active doctors in this clinic
    const doctorClinicDocs = await DoctorClinic.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
    })
      .sort({ doctorId: 1 })
      .lean();

    if (!doctorClinicDocs.length) {
      return res.status(404).json({ success: false, message: "No active doctors found for this clinic" });
    }

    let doctorIds = doctorClinicDocs.map((d) => d.doctorId.toString());

    // 2️⃣ Filter by department BEFORE pagination
    let filteredDoctorIds = [];
    if (department) {
      // Fetch details only for doctors that match department
      const deptPromises = doctorIds.map(async (doctorId) => {
        try {
          const doctorRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`);
          if (doctorRes.data?.success && doctorRes.data.doctor) {
            return doctorRes.data.doctor.specialization === department ? doctorRes.data.doctor._id : null;
          }
        } catch (err) {
          console.error(`Error fetching doctor ${doctorId}:`, err.message);
        }
        return null;
      });

      const deptResults = await Promise.all(deptPromises);
      filteredDoctorIds = deptResults.filter(Boolean);

      if (!filteredDoctorIds.length) {
        return res.status(404).json({ success: false, message: "No doctors found for this department" });
      }
    } else {
      filteredDoctorIds = doctorIds;
    }

    const totalDoctors = filteredDoctorIds.length;

    // 3️⃣ Apply pagination
    const paginatedDoctorIds = filteredDoctorIds.slice(skip, skip + parsedLimit);

    // 4️⃣ Fetch doctor details in parallel only for paginated IDs
    const doctorDetailsMap = {};
    const detailPromises = paginatedDoctorIds.map(async (doctorId) => {
      try {
        const doctorRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/doctor/details/${doctorId}`);
        doctorDetailsMap[doctorId] = doctorRes.data?.success && doctorRes.data.doctor
          ? doctorRes.data.doctor
          : { _id: doctorId, name: "Unknown Doctor" };
      } catch (err) {
        console.error(`Error fetching doctor ${doctorId}:`, err.message);
        doctorDetailsMap[doctorId] = { _id: doctorId, name: "Unknown Doctor" };
      }
    });
    await Promise.all(detailPromises);

    // 5️⃣ Fetch availabilities only for paginated doctors
    const allAvailabilities = await DoctorAvailability.find({
      doctorId: { $in: paginatedDoctorIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    })
      .select("doctorId clinicId dayOfWeek startTime endTime")
      .populate("clinicId", "name address")
      .lean();

    // 6️⃣ Map doctors with availability
    const doctors = paginatedDoctorIds.map((id) => {
      const docClinic = doctorClinicDocs.find((d) => d.doctorId.toString() === id) || {};
      return {
        doctorId: id,
        roleInClinic: docClinic.roleInClinic,
        clinicLogin: { email: docClinic.clinicLogin?.email },
        status: docClinic.status,
        doctor: doctorDetailsMap[id],
        availability: allAvailabilities.filter((a) => a.doctorId.toString() === id),
      };
    });

    const totalPages = Math.ceil(totalDoctors / parsedLimit);

    return res.status(200).json({
      success: true,
      clinicId,
      specialization: department || "All",
      totalDoctors,
      page: parseInt(page, 10),
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
  const { clinicEmail, clinicPassword } = req.body;

  try {
    // ✅ Validate input
    if (!clinicEmail || !clinicPassword) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // ✅ Find doctor-clinic mapping with this clinic email
    const doctorClinic = await DoctorClinic.findOne({ "clinicLogin.email": clinicEmail });

    if (!doctorClinic) {
      return res.status(404).json({ success: false, message: "Invalid email or password" });
    }

    // ✅ Compare password (assuming hashed in DB)
    const isMatch = await bcrypt.compare(clinicPassword, doctorClinic.clinicLogin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
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


export{onboardDoctor,addDoctorAvailability,getAvailability,clinicDoctorLogin,getDoctorsBasedOnDepartment,getDoctorsWithAvailability,getAllActiveDoctorsOnClinic}
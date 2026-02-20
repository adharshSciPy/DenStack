import Doctor from "../models/doctorSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";

import mongoose from "mongoose";
import Clinic from "../models/clinicSchema.js";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
config();

const generateDoctorId = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit random
  return `DCS-DR-${randomNum}`;
};
// ====== Register Doctor ======
const registerDoctor = async (req, res) => {
  const { name, email, phoneNumber, password, specialization, licenseNumber } =
    req.body;

  try {
    if (!name || !nameValidator(name)) {
      return res.status(400).json({ message: "Invalid name" });
    }

    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!phoneNumber || !phoneValidator(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    if (!password || !passwordValidator(password)) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (!licenseNumber) {
      return res.status(400).json({ message: "License number is required" });
    }

    const existingDoctorEmail = await Doctor.findOne({ email });
    if (existingDoctorEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingDoctorPhone = await Doctor.findOne({ phoneNumber });
    if (existingDoctorPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const existingLicense = await Doctor.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({ message: "License number already exists" });
    }

    // let uniqueId;
    // let exists = true;
    // while (exists) {
    //   uniqueId = generateDoctorId();
    //   exists = await Doctor.findOne({ uniqueId });
    // }

    const newDoctor = new Doctor({
      name,
      email,
      phoneNumber,
      password,
      specialization,
      licenseNumber,
      // uniqueId,
      approve: true, // default approved
    });

    await newDoctor.save();

    const accessToken = newDoctor.generateAccessToken();
    const refreshToken = newDoctor.generateRefreshToken();

    res.status(201).json({
      message: "Doctor registered successfully",
      doctor: {
        id: newDoctor._id,
        name: newDoctor.name,
        email: newDoctor.email,
        phoneNumber: newDoctor.phoneNumber,
        specialization: newDoctor.specialization,
        licenseNumber: newDoctor.licenseNumber,
        role: newDoctor.role,
        uniqueId: newDoctor.uniqueId,
        approve: newDoctor.approve,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerDoctor:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    res.status(500).json({ message: "Server error" });
  }
};

// ====== Login Doctor ======
// auth-service/controller/doctorController.js

const loginDoctor = async (req, res) => {
  const { email, password } = req.body;

  try {
    // ====== VALIDATIONS ======
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // ====== FIND DOCTOR ======
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ✅ Check approval status
    if (!doctor.approve) {
      return res.status(403).json({
        message: "Your account is not approved yet. Please contact admin.",
      });
    }

    // ====== VERIFY PASSWORD ======
    const isMatch = await doctor.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ====== CHECK IF DOCTOR IS ALSO CLINIC ADMIN (HYBRID) ======
    let clinic = null;
    let hybridRole = null;
    
    if (doctor.isClinicAdmin && doctor.linkedClinicId) {
      clinic = await Clinic.findById(doctor.linkedClinicId).select('-password');
      
      if (clinic) {
        hybridRole = process.env.HYBRID_ROLE || "760";
        console.log(`✅ Hybrid doctor detected: Doctor ${doctor._id} linked to Clinic ${clinic._id}`);
      }
    }

    // ====== GENERATE TOKENS BASED ON USER TYPE ======
    let accessToken, refreshToken;

    if (hybridRole && clinic) {
      // 🔥 HYBRID DOCTOR - Generate token with both IDs
      accessToken = jwt.sign(
        {
          _id: doctor._id,
          doctorId: doctor._id,
          clinicId: clinic._id,
          name: doctor.name,
          email: doctor.email,
          role: hybridRole,  // 760
          isHybrid: true,
          // Include doctor-specific fields
          specialization: doctor.specialization,
          licenseNumber: doctor.licenseNumber
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
      );

      refreshToken = jwt.sign(
        {
          doctorId: doctor._id,
          clinicId: clinic._id,
          role: hybridRole,
          isHybrid: true
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
      );
    } else {
      // 🔥 REGULAR DOCTOR - Use doctor's token generation
      accessToken = doctor.generateAccessToken();
      refreshToken = doctor.generateRefreshToken();
    }

    // ====== PREPARE RESPONSE ======
    const response = {
      message: hybridRole ? "Doctor login successful (with clinic admin privileges)" : "Login successful",
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phoneNumber: doctor.phoneNumber,
        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        role: hybridRole || doctor.role,
        uniqueId: doctor.uniqueId,
        approve: doctor.approve,
        isHybrid: !!hybridRole,
        isClinicAdmin: doctor.isClinicAdmin
      },
      accessToken,
      refreshToken,
    };

    // 🔥 Add clinic info if hybrid
    if (hybridRole && clinic) {
      response.clinic = {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        phoneNumber: clinic.phoneNumber,
        type: clinic.type,
        isClinicAdminDoctor: clinic.isClinicAdminDoctor
      };
      
      response.message = "Doctor login successful (with clinic admin privileges)";
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error in loginDoctor:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// unckecked api
const allDoctors = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // Search filter
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } }, // case-insensitive search
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    // Count total documents
    const total = await Doctor.countDocuments(query);

    // Pagination + sorting (newest first)
    const doctors = await Doctor.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctors",
    });
  }
};
const fetchDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID format",
      });
    }

    // ✅ Fetch doctor with only needed fields
    const doctor = await Doctor.findById(id).lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    console.error("❌ Error fetching doctor by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching doctor details",
      error: error.message,
    });
  }
};

const fetchDoctorByUniqueId = async (req, res) => {
  try {
    const { id: uniqueId } = req.params;

    const doctor = await Doctor.findOne({ uniqueId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error) {
    console.error("Error fetching doctor by uniqueId:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctor by uniqueId",
    });
  }
};

const doctorStats = async (req, res) => {
  try {
    const totalDoctors = await Doctor.countDocuments();

    const activeDoctors = await Doctor.countDocuments({ status: "Active" });

    const inactiveDoctors = await Doctor.countDocuments({ status: "Inactive" });

    const pendingDoctors = await Doctor.countDocuments({ status: "Pending" });

    const independentDoctors = await Doctor.countDocuments({
      isIndependent: true,
    });

    const clinicDoctors = await Doctor.countDocuments({
      isClinicOnboard: true,
    });

    res.status(200).json({
      success: true,
      stats: {
        totalDoctors,
        activeDoctors,
        inactiveDoctors,
        pendingDoctors,
        independentDoctors,
        clinicDoctors,
      },
    });
  } catch (error) {
    console.error("Doctor stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getDoctorsBatch = async (req, res) => {
  try {
    const { doctorIds } = req.body;

    if (!doctorIds || !Array.isArray(doctorIds)) {
      return res.status(400).json({
        success: false,
        message: "doctorIds array is required",
      });
    }

    // Limit the number of IDs to prevent abuse
    const limitedIds = doctorIds.slice(0, 100);
    const objectIds = limitedIds.map((id) => new mongoose.Types.ObjectId(id));

    const doctors = await Doctor.find({
      _id: { $in: objectIds },
    })
      .select("name email  specialization")
      .lean();

    // Convert to map for easy lookup
    const doctorsMap = {};
    doctors.forEach((doctor) => {
      doctorsMap[doctor._id] = doctor;
    });

    res.json({
      success: true,
      doctors: doctorsMap,
      count: doctors.length,
    });
  } catch (error) {
    console.error("Error in getDoctorsBatch:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
const updateDoctorClinicStatus = async (req, res) => {
  try {
    const { doctorId, clinicId, action } = req.body;

    // Validate inputs
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid doctorId" 
      });
    }

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid clinicId" 
      });
    }

    if (!['onboard', 'remove'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: "Action must be 'onboard' or 'remove'" 
      });
    }

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: "Doctor not found" 
      });
    }

    if (action === 'onboard') {
      // Check if already onboarded to this clinic
      const existingClinic = doctor.clinicOnboardingDetails.find(
        detail => detail.clinicId.toString() === clinicId
      );

      if (existingClinic) {
        // Reactivate if previously inactive
        existingClinic.status = 'active';
        existingClinic.onboardedAt = new Date();
      } else {
        // Add new clinic
        doctor.clinicOnboardingDetails.push({
          clinicId,
          status: 'active',
          onboardedAt: new Date()
        });
      }

      doctor.isClinicDoctor = true;

    } else if (action === 'remove') {
      // Find and update status to inactive
      const clinicDetail = doctor.clinicOnboardingDetails.find(
        detail => detail.clinicId.toString() === clinicId
      );

      if (clinicDetail) {
        clinicDetail.status = 'inactive';
      }

      // Check if doctor has any active clinics
      const hasActiveClinics = doctor.clinicOnboardingDetails.some(
        detail => detail.status === 'active'
      );

      doctor.isClinicDoctor = hasActiveClinics;
    }

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: `Doctor ${action === 'onboard' ? 'onboarded to' : 'removed from'} clinic successfully`,
      data: {
        doctorId: doctor._id,
        isClinicDoctor: doctor.isClinicDoctor,
        clinicOnboardingDetails: doctor.clinicOnboardingDetails
      }
    });

  } catch (error) {
    console.error("❌ Error updating doctor clinic status:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error",
      details: error.message 
    });
  }
};

export {
  registerDoctor,
  loginDoctor,
  allDoctors,
  fetchDoctorById,
  fetchDoctorByUniqueId,
  doctorStats,
  getDoctorsBatch,
  updateDoctorClinicStatus
};

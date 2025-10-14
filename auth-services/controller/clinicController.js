import Clinic from "../models/clinicSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
import mongoose from "mongoose";
import { config } from "dotenv";
import axios from "axios";
import { response } from "express";
config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL || "http://localhost:8003/api/v1/clinic-service";
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL || "http://localhost:8002/api/v1/patient-service";
const registerClinic = async (req, res) => {
  const { name, type, email, phoneNumber, password, address, description, } = req.body;

  try {

    // ====== VALIDATIONS ======
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

    // ====== CHECK IF ALREADY EXISTS ======
    const existingClinicEmail = await Clinic.findOne({ email });
    if (existingClinicEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingClinicPhone = await Clinic.findOne({ phoneNumber });
    if (existingClinicPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // ====== CREATE CLINIC ======
    const newClinic = new Clinic({
      name,
      type,
      email,
      phoneNumber,
      password,
      address,
      description,

    });

    await newClinic.save();

    // ====== GENERATE TOKENS ======
    const accessToken = newClinic.generateAccessToken();
    const refreshToken = newClinic.generateRefreshToken();

    res.status(201).json({
      message: "Clinic registered successfully",
      clinic: {
        id: newClinic._id,
        name: newClinic.name,
        email: newClinic.email,
        phoneNumber: newClinic.phoneNumber,
        type: newClinic.type,
        role: newClinic.role,
        subscription: newClinic.subscription,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerClinic:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const loginClinic = async (req, res) => {
  const { email, password } = req.body;

  try {

    // ====== VALIDATIONS ======
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // ====== FIND CLINIC ======
    const clinic = await Clinic.findOne({ email });
    if (!clinic) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ====== VERIFY PASSWORD ======
    const isMatch = await clinic.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ====== GENERATE TOKENS ======
    const accessToken = clinic.generateAccessToken();
    const refreshToken = clinic.generateRefreshToken();

    res.status(200).json({
      message: "Login successful",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        phoneNumber: clinic.phoneNumber,
        type: clinic.type,
        role: clinic.role,
        subscription: clinic.subscription,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginClinic:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const viewAllClinics = async (req, res) => {
  try {
    let { page, limit } = req.query;

    // Convert to number and set defaults
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;

    // Fetch clinics with pagination
    const clinics = await Clinic.find()
      .skip(skip)
      .limit(limit);

    // Get total count for frontend pagination
    const total = await Clinic.countDocuments();

    res.status(200).json({
      message: "Clinics Fetched Successfully",
      data: clinics,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};


const viewClinicById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic = await Clinic.findById(id);
    res.status(200).json({ message: "View Clinic", data: clinic })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

const editClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const { name,
      type,
      email,
      phoneNumber,
      address,
      description } = req.body
    const editRes = await Clinic.findByIdAndUpdate(id, {
      name,
      type,
      email,
      phoneNumber,
      address,
      description,
    }, { new: true })
    res.status(200).json({ message: "Clinic updated successfully", data: editRes })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}
const getClinicStaffs = async (req, res) => {
  const {id: clinicId } = req.params;

  try {
    const clinic = await Clinic.findById(clinicId)
      .populate("staffs.nurses")
      .populate("staffs.receptionists", )
      .populate("staffs.pharmacists", )
      .populate("staffs.accountants",);

    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    res.status(200).json({
      message: "Clinic staff fetched successfully",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        staffs: clinic.staffs,
      },
    });
  } catch (error) {
    console.error("❌ Error in getClinicStaffs:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getTheme=async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.clinicId).select("theme");
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });
    res.json(clinic.theme);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const editTheme=async (req, res) => {
  try {
    const { startColor, endColor, primaryForeground, sidebarForeground,secondary } = req.body;
    const clinic = await Clinic.findByIdAndUpdate(
      req.params.clinicId,
      { theme: { startColor, endColor, primaryForeground, sidebarForeground ,secondary} },
      { new: true }
    );
    res.json({ message: "Theme updated successfully", theme: clinic.theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
const subscribeClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, package: pkg, price } = req.body;

    const clinic = await Clinic.findById(id);
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });

    const subscription = clinic.activateSubscription(type, pkg, price);
    await clinic.save();

    res.status(200).json({
      success: true,
      message: `Clinic subscribed to ${pkg} plan (${type}) successfully`,
      subscription,
    });
  } catch (error) {
    console.error("Error subscribing clinic:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getClinicDashboardDetails = async (req, res) => {
  try {
    const { id: clinicId } = req.params;

    // ✅ Validate clinic ID
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    // ✅ Fetch clinic info (only DB call — can't parallelize easily)
    const clinic = await Clinic.findById(clinicId)
      .populate("staffs.nurses")
      .populate("staffs.receptionists")
      .populate("staffs.pharmacists")
      .populate("staffs.accountants")
      .populate("staffs.technicians")
      .lean();

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // ✅ Define async functions for each external API
    const fetchPatients = async () => {
      try {
        const response = await axios.get(
          `${PATIENT_SERVICE_BASE_URL}/patient/clinic-patients/${clinicId}`
        );
        return response.data?.data || [];
      } catch (err) {
        console.error("❌ Error fetching patients:", err.message);
        return [];
      }
    };

    const fetchAppointments = async () => {
      try {
        const response = await axios.get(
          `${PATIENT_SERVICE_BASE_URL}/appointment/clinic-appointments/${clinicId}`
        );
        return response.data?.data || [];
      } catch (err) {
        console.error("❌ Error fetching appointments:", err.message);
        return [];
      }
    };

    const fetchActiveDoctors = async () => {
      try {
        const response = await axios.get(
          `${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${clinicId}`
        );
        return response.data?.doctors || [];
      } catch (err) {
        console.error("❌ Error fetching active doctors:", err.message);
        return [];
      }
    };

    // ✅ Run all 3 external requests in parallel to speed things up
    const [patients, todaysAppointments, activeDoctors] = await Promise.all([
      fetchPatients(),
      fetchAppointments(),
      fetchActiveDoctors(),
    ]);

    // ✅ Respond with combined dashboard data
    return res.status(200).json({
      success: true,
      clinic: {
        id: clinic._id,
        name: clinic.name,
        staffs: clinic.staffs,
        subscription: clinic.subscription,
      },
      patients,
      todaysAppointments,
      activeDoctors,
    });

  } catch (error) {
    console.error("getClinicDashboardDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching clinic dashboard",
      error: error.message,
    });
  }
};
export { registerClinic, loginClinic, viewAllClinics, viewClinicById, editClinic,getClinicStaffs ,getTheme,editTheme,subscribeClinic,getClinicDashboardDetails};
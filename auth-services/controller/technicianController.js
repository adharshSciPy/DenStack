import Technician from "../models/technicianSchema.js";
import Clinic from "../models/clinicSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
import bcrypt from "bcrypt";
import { sendOTPEmail } from "../services/emailService.js";
import crypto from "crypto";

// ====== Register Nurse ======
// ====== Register Nurse ======
const registerTechnician = async (req, res) => {
  const {
    name,
    email,
    phoneNumber,
    password,
    clinicId,
    labVendorId,
    labType: incomingLabType, // ALIGNER / EXTERNAL comes from frontend
  } = req.body;

  console.log("this", req.body);

  try {
    // 🔹 Basic validations
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

    // 🔹 Duplicate checks
    if (await Technician.findOne({ email })) {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (await Technician.findOne({ phoneNumber })) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    let clinic = null;
    let labType = null;

    // 🔹 CASE 1: Clinic technician → INHOUSE
    if (clinicId) {
      clinic = await Clinic.findById(clinicId);

      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }

      if (!clinic.features?.canAddStaff?.technicians) {
        return res.status(403).json({
          message:
            "This clinic’s current plan does not allow adding technicians.",
        });
      }

      labType = "inHouse";
    }

    // 🔹 CASE 2: No clinic → ALIGNER / EXTERNAL
    if (!clinicId) {
      if (
        !incomingLabType ||
        !["aligner", "external"].includes(incomingLabType)
      ) {
        return res.status(400).json({
          message:
            "labType must be ALIGNER or EXTERNAL for non-clinic technicians",
        });
      }

      labType = incomingLabType;
    }

    // 🔹 Create technician
    const newTechnician = new Technician({
      name,
      email,
      phoneNumber,
      password,
      clinicId: clinicId || null,
      labVendorId: labVendorId || null,
      labType, // ✅ derived strictly by backend
    });

    await newTechnician.save();

    // 🔹 Push technician into clinic staff
    if (clinicId) {
      await Clinic.updateOne(
        { _id: clinicId },
        { $push: { "staffs.technicians": newTechnician._id } },
      );
    }

    // 🔹 Tokens
    const accessToken = newTechnician.generateAccessToken();
    const refreshToken = newTechnician.generateRefreshToken();

    return res.status(200).json({
      message: "Technician registered successfully",
      Technician: {
        id: newTechnician._id,
        name: newTechnician.name,
        email: newTechnician.email,
        phoneNumber: newTechnician.phoneNumber,
        role: newTechnician.role,
        technicianId: newTechnician.technicianId,
        clinicId: newTechnician.clinicId,
        labVendorId: newTechnician.labVendorId,
        labType: newTechnician.labType,
      },
      clinic: clinic
        ? {
            id: clinic._id,
            name: clinic.name,
          }
        : null,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerTechnician:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ====== Login Nurse ======
const loginTechnician = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const technician = await Technician.findOne({ email });
    if (!technician) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await technician.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const accessToken = technician.generateAccessToken();
    const refreshToken = technician.generateRefreshToken();

    res.status(200).json({
      message: "Login successful",
      LabTechnician: {
        id: technician._id,
        name: technician.name,
        email: technician.email,
        phoneNumber: technician.phoneNumber,
        role: technician.role,
        nurseId: technician.nurseId,
        clinicId: technician.clinicId,
        labVendorId: technician.labVendorId,
        labType: technician.labType,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginNurse:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const allTechnicians = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // Search filter
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } }, // case-insensitive search
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$phoneNumber" },
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    // Count total documents
    const total = await Technician.countDocuments(query);

    // Pagination + sorting (newest first)
    const technicians = await Technician.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      technicians,
    });
  } catch (error) {
    console.error("Error fetching Technicians:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching Technicians",
    });
  }
};

const fetchTechnicianById = async (req, res) => {
  try {
    const { id } = req.params;

    const technician = await Technician.findById(id);
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: "Technician not found",
      });
    }

    res.status(200).json({
      success: true,
      technician,
    });
  } catch (error) {
    console.error("Error fetching Technician by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching Technician by ID",
    });
  }
};

const editTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phoneNumber,
      department,
      specialization,
      shift,
      experienceYears,
      status,
    } = req.body;
    const editRes = await Technician.findByIdAndUpdate(
      id,
      {
        name,
        phoneNumber,
        email,
        department,
        specialization,
        shift,
        experienceYears,
        status,
      },
      { new: true },
    );
    res
      .status(200)
      .json({ message: "Update Technician Successfully", data: editRes });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
const forgotTechnicianPassword = async (req, res) => {
  try {

    const { email } = req.body;

    const user = await Technician.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6 digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 min

    await user.save();

    await sendOTPEmail(email, otp);

    res.json({
      message: "OTP sent to email",
    });
console.log(otp);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const verifyTechnicianOTP = async (req, res) => {

  const { email, otp } = req.body;

  const user = await Technician.findOne({
    email,
    otp,
    otpExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  res.json({
    message: "OTP verified"
  });

};
const resetTechnicianPassword = async (req, res) => {

  const { email, otp, newPassword } = req.body;

  const user = await Technician.findOne({
    email,
    otp,
    otpExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  user.password = newPassword;
  user.otp = undefined;
  user.otpExpires = undefined;

  await user.save();

  res.json({
    message: "Password reset successful"
  });

};
export {
  registerTechnician,
  loginTechnician,
  allTechnicians,
  fetchTechnicianById,
  editTechnician,
  forgotTechnicianPassword,
  verifyTechnicianOTP,
  resetTechnicianPassword,
};

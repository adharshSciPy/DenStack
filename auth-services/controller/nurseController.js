import Nurse from "../models/nurseSchema.js";
import Clinic from "../models/clinicSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
import bcrypt from "bcrypt"
import { sendOTPEmail } from "../services/emailService.js";
import crypto from "crypto";

// ====== Register Nurse ======
// ====== Register Nurse ======
const registerNurse = async (req, res) => {
  const { name, email, phoneNumber, password, clinicId } = req.body;

  try {
    // Validate required fields
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
    if (!clinicId) {
      return res.status(400).json({ message: "Clinic ID is required" });
    }

    // Check if clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }
    if (!clinic.features?.canAddStaff?.nurses) {
      return res.status(403).json({
        message: "This clinic’s current plan does not allow adding nurses.",
      });
    }

    // Check if nurse email/phone already exists
    const existingNurseEmail = await Nurse.findOne({ email });
    if (existingNurseEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingNursePhone = await Nurse.findOne({ phoneNumber });
    if (existingNursePhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // Create nurse
    const newNurse = new Nurse({
      name,
      email,
      phoneNumber,
      password
    });

    await newNurse.save();

    // Push nurse _id into clinic.staffs.nurses
    clinic.staffs.nurses.push(newNurse._id);
    await clinic.save();

    // Generate tokens
    const accessToken = newNurse.generateAccessToken();
    const refreshToken = newNurse.generateRefreshToken();

    res.status(201).json({
      message: "Nurse registered successfully",
      Nurse: {
        id: newNurse._id,
        name: newNurse.name,
        email: newNurse.email,
        phoneNumber: newNurse.phoneNumber,
        role: newNurse.role,
        nurseId: newNurse.nurseId
      },
      clinic: {
        id: clinic._id,
        name: clinic.name,
        staffs: clinic.staffs
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerNurse:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    res.status(500).json({ message: "Server error" });
  }
};


// ====== Login Nurse ======
const loginNurse = async (req, res) => {
  const { email, password } = req.body;

  try {

    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }


    const nurse = await Nurse.findOne({ email });
    if (!nurse) {
      return res.status(400).json({ message: "Invalid email or password" });
    }


    const isMatch = await nurse.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }


    const accessToken = nurse.generateAccessToken();
    const refreshToken = nurse.generateRefreshToken();

    res.status(200).json({
      message: "Login successful",
      Nurse: {
        id: nurse._id,
        name: nurse.name,
        email: nurse.email,
        phoneNumber: nurse.phoneNumber,
        role: nurse.role,
        nurseId: nurse.nurseId
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginNurse:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// unckecked api
const allNurses = async (req, res) => {
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
              options: "i"
            }
          }
        }
      ];
    }

    // Count total documents
    const total = await Nurse.countDocuments(query);

    // Pagination + sorting (newest first)
    const nurses = await Nurse.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      nurses
    });
  } catch (error) {
    console.error("Error fetching Nurses:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching Nurses",
    });
  }
};
const fetchNurseById = async (req, res) => {
  try {
    const { id } = req.params;

    const nurse = await Nurse.findById(id);
    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: "Nurse not found",
      });
    }

    res.status(200).json({
      success: true,
      nurse,
    });
  } catch (error) {
    console.error("Error fetching Nurse by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching Nurse by ID",
    });
  }
};
const forgotNursePassword = async (req, res) => {
  try {

    const { email } = req.body;

    const user = await Nurse.findOne({ email });

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
const verifyNurseOTP = async (req, res) => {

  const { email, otp } = req.body;

  const user = await Nurse.findOne({
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
const resetNursePassword = async (req, res) => {

  const { email, otp, newPassword } = req.body;

  const user = await Nurse.findOne({
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

export { registerNurse, loginNurse, allNurses, fetchNurseById ,forgotNursePassword,verifyNurseOTP,resetNursePassword };

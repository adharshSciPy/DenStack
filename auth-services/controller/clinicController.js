import Clinic from "../models/clinicSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
const registerClinic = async (req, res) => {
    const { name, type, email, phoneNumber, password, address, description,} = req.body;

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
        role:newClinic.role,
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

export{registerClinic,loginClinic}
import Technician from "../models/technicianSchema.js";
import Clinic from "../models/clinicSchema.js";
import {
    nameValidator,
    emailValidator,
    passwordValidator,
    phoneValidator,
} from "../utils/validators.js";
import bcrypt from "bcrypt"

// ====== Register Nurse ======
// ====== Register Nurse ======
const registerTechnician = async (req, res) => {
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

    // Check if nurse email/phone already exists
    const existingTechnicianEmail = await Technician.findOne({ email });
    if (existingTechnicianEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingTechnicianPhone = await Technician.findOne({ phoneNumber });
    if (existingTechnicianPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // Create nurse
    const newTechnician = new Nurse({
      name,
      email,
      phoneNumber,
      password
    });

    await newTechnician.save();

    // Push nurse _id into clinic.staffs.nurses
    clinic.staffs.tec.push(newNurse._id);
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
                { phoneNumber: { $regex: search, $options: "i" } }
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

export { registerNurse, loginNurse, allNurses, fetchNurseById };

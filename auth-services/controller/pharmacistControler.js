import Pharmacist from "../models/pharmacistSchema.js";
import {
    nameValidator,
    emailValidator,
    passwordValidator,
    phoneValidator,
} from "../utils/validators.js";
import Clinic from "../models/clinicSchema.js";

// ====== Register Pharmacist ======
const registerPharmacist = async (req, res) => {
  const { name, email, phoneNumber, password, clinicId } = req.body;

  try {
    // ✅ Validate required fields
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

    // ✅ Check if clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    // ✅ Check if email/phone already exists
    const existingPharmacistEmail = await Pharmacist.findOne({ email });
    if (existingPharmacistEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingPharmacistPhone = await Pharmacist.findOne({ phoneNumber });
    if (existingPharmacistPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // ✅ Create Pharmacist (auto-generated pharmacistId)
    const newPharmacist = new Pharmacist({
      name,
      email,
      phoneNumber,
      password,
    });

    await newPharmacist.save();

    // ✅ Push pharmacist _id into clinic.staffs.pharmacists
    clinic.staffs.pharmacists.push(newPharmacist._id);
    await clinic.save();

    // ✅ Generate tokens
    const accessToken = newPharmacist.generateAccessToken();
    const refreshToken = newPharmacist.generateRefreshToken();

    res.status(201).json({
      message: "Pharmacist registered successfully",
      pharmacist: {
        id: newPharmacist._id,
        name: newPharmacist.name,
        email: newPharmacist.email,
        phoneNumber: newPharmacist.phoneNumber,
        role: newPharmacist.role,
        pharmacistId: newPharmacist.pharmacistId,
      },
      clinic: {
        id: clinic._id,
        name: clinic.name,
        staffs: clinic.staffs,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerPharmacist:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    res.status(500).json({ message: "Server error" });
  }
};


// ====== Login Pharmacist ======
const loginPharmacist = async (req, res) => {
    const { email, password } = req.body;

    try {

        if (!email || !emailValidator(email)) {
            return res.status(400).json({ message: "Invalid email" });
        }

        if (!password) {
            return res.status(400).json({ message: "Password is required" });
        }


        const pharmacist = await Pharmacist.findOne({ email });
        if (!pharmacist) {
            return res.status(400).json({ message: "Invalid email or password" });
        }


        const isMatch = await pharmacist.isPasswordCorrect(password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }


        const accessToken = pharmacist.generateAccessToken();
        const refreshToken = pharmacist.generateRefreshToken();

        res.status(200).json({
            message: "Login successful",
            Pharmacist: {
                id: pharmacist._id,
                name: pharmacist.name,
                email: pharmacist.email,
                phoneNumber: pharmacist.phoneNumber,
                role: pharmacist.role,
                pharmacistId: pharmacist.pharmacistId
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("❌ Error in loginPharmacist:", error);
        res.status(500).json({ message: "Server error" });
    }
};
// unckecked api
const allPharmacists = async (req, res) => {
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
        const total = await Pharmacist.countDocuments(query);

        // Pagination + sorting (newest first)
        const pharmacists = await Pharmacist.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            pharmacists
        });
    } catch (error) {
        console.error("Error fetching Pharmacists:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching Pharmacists",
        });
    }
};
const fetchPharmacistById = async (req, res) => {
    try {
        const { id } = req.params;

        const pharmacist = await Pharmacist.findById(id);
        if (!pharmacist) {
            return res.status(404).json({
                success: false,
                message: "Pharmacist not found",
            });
        }

        res.status(200).json({
            success: true,
            pharmacist,
        });
    } catch (error) {
        console.error("Error fetching Pharmacist by ID:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching Pharmacist by ID",
        });
    }
};

export { registerPharmacist, loginPharmacist, allPharmacists, fetchPharmacistById };

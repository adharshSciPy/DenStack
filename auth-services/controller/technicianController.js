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
        const newTechnician = new Technician({
            name,
            email,
            phoneNumber,
            password
        });

        await newTechnician.save();

        // Push nurse _id into clinic.staffs.nurses
        clinic.staffs.technicians.push(newTechnician._id);
        await clinic.save();

        // Generate tokens
        const accessToken = newTechnician.generateAccessToken();
        const refreshToken = newTechnician.generateRefreshToken();

        res.status(200).json({
            message: "Technician registered successfully",
            Technician: {
                id: newTechnician._id,
                name: newTechnician.name,
                email: newTechnician.email,
                phoneNumber: newTechnician.phoneNumber,
                role: newTechnician.role,
                technicianId: newTechnician.technicianId
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
            Nurse: {
                id: technician._id,
                name: technician.name,
                email: technician.email,
                phoneNumber: technician.phoneNumber,
                role: technician.role,
                nurseId: technician.nurseId
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
                            options: "i"
                        }
                    }
                }
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
            technicians
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
        const { name, email, phoneNumber, department, specialization, shift, experienceYears, status } = req.body;
        const editRes = await Technician.findByIdAndUpdate(id, {
            name, phoneNumber, email, department, specialization, shift, experienceYears, status
        }, { new: true })
        res.status(200).json({ message: "Update Technician Successfully", data: editRes })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

export { registerTechnician, loginTechnician, allTechnicians, fetchTechnicianById, editTechnician };

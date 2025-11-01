import PRO from "../models/PROSchema.js";
import { nameValidator, emailValidator, passwordValidator, phoneValidator } from "../utils/validators.js";
import mongoose from "mongoose";

const generatePROId = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `DCS_PRO_${randomNum}`
}

const registerPRO = async (req, res) => {
    const { name, email, phoneNumber, password } = req.body;
    try {
        if (!name || !nameValidator(name)) {
            return res.status(400).json({ message: "Invalid Name" });
        }
        if (!email || !emailValidator(email)) {
            return res.status(400).json({ message: "Invalid Email" })
        }
        if (!password || !passwordValidator(password)) {
            return res.status(400).json({ message: "Invalid Password" })
        }
        if (!phoneNumber || !phoneValidator(phoneNumber)) {
            return res.status(400).json({ message: "Invalid Phone Number" })
        }

        const existingEmail = await PRO.findOne({ email })
        if (existingEmail) {
            return res.status(400).json({ message: "Email already exists" })
        }
        const existingPhone = await PRO.findOne({ phoneNumber })
        if (existingPhone) {
            return res.status(400).json({ message: "Phone Number already exists" })
        }
        let uniqueId;
        let exists = true;
        while (exists) {
            uniqueId = generatePROId();
            exists = await PRO.findOne({ uniqueId })
        }

        const newPRO = new PRO({
            name, email, password, phoneNumber, uniqueId, approve: true
        })
        await newPRO.save();
        const accessToken = newPRO.generateAccessToken();
        const refreshToken = newPRO.generateRefreshToken();

        res.status(200).json({
            message: "PRO registered successfully",
            PRO: {
                id: newPRO._id,
                name: newPRO.name,
                email: newPRO.email,
                phoneNumber: newPRO.phoneNumber,
                role: newPRO.role,
                uniqueId: newPRO.uniqueId,
                approve: newPRO.approve
            },
            accessToken,
            refreshToken
        })
    } catch (error) {
        console.error("❌ Error in registerpro:", error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ message: `${field} already exists` });
        }

        res.status(500).json({ message: "Server error" });
    }
}

const loginpro = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !emailValidator(email)) {
            return res.status(400).json({ message: "Invalid email" });
        }

        if (!password) {
            return res.status(400).json({ message: "Password is required" });
        }

        const pro = await PRO.findOne({ email });
        if (!pro) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // ✅ Check approval status
        if (!pro.approve) {
            return res.status(403).json({ message: "Your account is not approved yet. Please contact admin." });
        }

        const isMatch = await pro.isPasswordCorrect(password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const accessToken = pro.generateAccessToken();
        const refreshToken = pro.generateRefreshToken();

        res.status(200).json({
            message: "Login successful",
            pro: {
                id: pro._id,
                name: pro.name,
                email: pro.email,
                phoneNumber: pro.phoneNumber,
                role: pro.role,
                uniqueId: pro.uniqueId,
                approve: pro.approve,
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("❌ Error in loginpro:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const allPros = async (req, res) => {
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
        const total = await PRO.countDocuments(query);

        // Pagination + sorting (newest first)
        const pros = await PRO.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            pros
        });
    } catch (error) {
        console.error("Error fetching pros:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching pros",
        });
    }
};

const fetchProById = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid PRO ID format",
            });
        }

        // ✅ Fetch doctor with only needed fields
        const pro = await PRO.findById(id).lean();

        if (!pro) {
            return res.status(404).json({
                success: false,
                message: "PRO not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: pro,
        });
    } catch (error) {
        console.error("❌ Error fetching PRO by ID:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching PRO details",
            error: error.message,
        });
    }
};

const fetchProByUniqueId = async (req, res) => {
    try {
        const { id: uniqueId } = req.params;

        const pro = await PRO.findOne({ uniqueId });
        if (!pro) {
            return res.status(404).json({
                success: false,
                message: "PRO not found",
            });
        }

        res.status(200).json({
            success: true,
            pro,
        });
    } catch (error) {
        console.error("Error fetching PRO by uniqueId:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching PRO by uniqueId",
        });
    }
};

const updatePRO = async (req, res) => {
    const { id } = req.params;
    const { name, email, phoneNumber } = req.body;
    try {
        const response = await PRO.findByIdAndUpdate(id, {
            name, email, phoneNumber
        }, { new: true })
        res.status(200).json({ message: "Updated Successfully", data: response })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

const deletePRO = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await PRO.findByIdAndDelete(id)
        res.status(200).json({ message: "Deleted Successfully", data: response })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
    }
}

export {
    registerPRO, loginpro, allPros, fetchProById, fetchProByUniqueId, updatePRO, deletePRO
}
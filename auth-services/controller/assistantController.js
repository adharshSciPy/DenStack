import Assistant from "../models/assistantSchema.js"
import { nameValidator, emailValidator, passwordValidator, phoneValidator } from "../utils/validators.js";
import mongoose from "mongoose";

const generatePROId = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `DCS_ASSIST_${randomNum}`
}

const registerAssistant = async (req, res) => {
    const { name, phoneNumber, email, password } = req.body;
    try {
        if (!name || !nameValidator(name)) {
            return res.status(400).json({ message: "Invalid Name" })
        }
        if (!email || !emailValidator(email)) {
            return res.status(400).json({ message: "Invalid Email" })
        }
        if (!phoneNumber || !phoneValidator(phoneNumber)) {
            return res.status(400).json({ message: "Invalid Phone Number" })
        }
        if (!password || !passwordValidator(password)) {
            return res.status(400).json({ message: "Invalid Password" })
        }
        const existingEmail = await Assistant.findOne({ email })
        if (existingEmail) {
            return res.status(400).json({ message: "Email already exists" })
        }
        const existingPhone = await Assistant.findOne({ phoneNumber })
        if (existingPhone) {
            return res.status(400).json({ message: "Phone Number already exists" })
        }
        let uniqueId;
        let exists = true;
        while (exists) {
            uniqueId = generatePROId();
            exists = await Assistant.findOne({ uniqueId })
        }
        const newAssistant = new Assistant({
            name, phoneNumber, email, password, uniqueId, approve: true
        })
        await newAssistant.save();
        const accessToken = newAssistant.generateAccessToken();
        const refreshToken = newAssistant.generateRefreshToken();
        res.status(200).json({
            message: "Assistant registered successfully",
            Assistant: {
                id: newAssistant._id,
                name: newAssistant.name,
                email: newAssistant.email,
                phoneNumber: newAssistant.phoneNumber,
                role: newAssistant.role,
                uniqueId: newAssistant.uniqueId,
                approve: newAssistant.approve
            },
            accessToken,
            refreshToken
        })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message })
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ message: `${field} already exists` });
        }

        res.status(500).json({ message: "Server error" });
    }

}

const loginAssistant = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !emailValidator(email)) {
            return res.status(400).json({ message: "Invalid Email" })
        }
        if (!password || !passwordValidator(password)) {
            return res.status(400).json({ message: "Invalid Password" })
        }
        const assistant = await Assistant.findOne({ email })
        if (!assistant) {
            return res.status(400).json({ message: "Invalid Email or Password" })
        }
        if (!assistant.approve) {
            return res.status(400).json({ message: "Your account is not approved yet. Please contact admin" })
        }
        const isMatch = await assistant.isPasswordCorrect(password)
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        const accessToken = assistant.generateAccessToken();
        const refreshToken = assistant.generateRefreshToken();
        res.status(200).json({
            message: "Login successful",
            pro: {
                id: assistant._id,
                name: assistant.name,
                email: assistant.email,
                phoneNumber: assistant.phoneNumber,
                role: assistant.role,
                uniqueId: assistant.uniqueId,
                approve: assistant.approve,
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("❌ Error in loginpro:", error);
        res.status(500).json({ message: "Server error" });
    }
}

const allAssistant = async (req, res) => {
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
        const total = await Assistant.countDocuments(query);

        // Pagination + sorting (newest first)
        const assistants = await Assistant.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            assistants
        });
    } catch (error) {
        console.error("Error fetching assistants:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching assistants",
        });
    }
};

const fetchAssistantById = async (req, res) => {
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
        const assistants = await Assistant.findById(id).lean();

        if (!assistants) {
            return res.status(404).json({
                success: false,
                message: "Assistants not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: assistants,
        });
    } catch (error) {
        console.error("❌ Error fetching Assistant by ID:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching Assistant details",
            error: error.message,
        });
    }
};

const fetchAssistantByUniqueId = async (req, res) => {
    try {
        const { id: uniqueId } = req.params;

        const assistant = await Assistant.findOne({ uniqueId });
        if (!assistant) {
            return res.status(404).json({
                success: false,
                message: "Assistant not found",
            });
        }

        res.status(200).json({
            success: true,
            assistant,
        });
    } catch (error) {
        console.error("Error fetching Assistant by uniqueId:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching Assistant by uniqueId",
        });
    }
};

export {
    registerAssistant, loginAssistant, allAssistant, fetchAssistantById, fetchAssistantByUniqueId
}

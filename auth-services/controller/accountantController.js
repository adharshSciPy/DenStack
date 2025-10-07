import Accountant from "../models/accountantSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
import Clinic from "../models/clinicSchema.js";

const registerAccountant = async (req, res) => {
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
    const existingAccountantEmail = await Accountant.findOne({ email });
    if (existingAccountantEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingAccountantPhone = await Accountant.findOne({ phoneNumber });
    if (existingAccountantPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // ✅ Create Accountant
    const newAccountant = new Accountant({
      name,
      email,
      phoneNumber,
      password,
    });

    await newAccountant.save();

    // ✅ Push accountant _id into clinic.staffs.accountants
    clinic.staffs.accountants.push(newAccountant._id);
    await clinic.save();

    // ✅ Generate tokens
    const accessToken = newAccountant.generateAccessToken();
    const refreshToken = newAccountant.generateRefreshToken();

    res.status(201).json({
      message: "Accountant registered successfully",
      accountant: {
        id: newAccountant._id,
        name: newAccountant.name,
        email: newAccountant.email,
        phoneNumber: newAccountant.phoneNumber,
        role: newAccountant.role,
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
    console.error("❌ Error in registerAccountant:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    res.status(500).json({ message: "Server error" });
  }
};

const loginAccountant = async (req, res) => {
  const { email, password } = req.body;

  try {
    
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

  
    const accountant = await Accountant.findOne({ email });
    if (!accountant) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   
    const isMatch = await Accountant.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   
    const accessToken = accountant.generateAccessToken();
    const refreshToken = accountant.generateRefreshToken();

    res.status(200).json({
      message: "Login successful",
      accountant: {
        id: accountant._id,
        name: accountant.name,
        email: accountant.email,
        phoneNumber: accountant.phoneNumber,
        role: accountant.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in accountantlogin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

 const fetchAccountantById = async (req, res) => {
  try {
    const { id } = req.params;

    const accountant = await Accountant.findById(id);
    if (!accountant) {
      return res.status(404).json({
        success: false,
        message: "Accountant not found",
      });
    }

    res.status(200).json({
      success: true,
      accountant,
    });
  } catch (error) {
    console.error("Error fetching accountant by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching accountant by ID",
    });
  }
};
const allAccountants = async (req, res) => {
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
    const total = await Accountant.countDocuments(query);

    // Pagination + sorting (newest first)
    const accountants = await Accountant.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      accountants
    });
  } catch (error) {
    console.error("Error fetching accountants:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching accountants",
    });
  }
};
export { registerAccountant ,loginAccountant,fetchAccountantById,allAccountants};
import Accountant from "../models/accountantSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";

const registerAccountant = async (req, res) => {
  const { name, email, phoneNumber, password } = req.body;

  try {

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


    const existingAccountantEmail = await Accountant.findOne({ email });
    if (existingAccountantEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingAccountantPhone = await Doctor.findOne({ phoneNumber });
    if (existingAccountantPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const newAccountant = new Accountant({
      name,
      email,
      phoneNumber,
      password
    });

    await newAccountant.save();

   
    const accessToken = newAccountant.generateAccessToken();
    const refreshToken = newAccountant.generateRefreshToken();

    res.status(201).json({
      message: "Accountant registered successfully",
      doctor: {
        id: newAccountant._id,
        name: newAccountant.name,
        email: newAccountant.email,
        phoneNumber: newAccountant.phoneNumber,
        role: newAccountant.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerDoctor:", error);


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
    console.error("❌ Error in loginDoctor:", error);
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
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error) {
    console.error("Error fetching doctor by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctor by ID",
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
    console.error("Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctors",
    });
  }
};
export { registerAccountant ,loginAccountant,fetchAccountantById,allAccountants};
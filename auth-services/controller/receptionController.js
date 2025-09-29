import Reception from "../models/receptionSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";

// ====== Register Reception ======
const registerReception = async (req, res) => {
  const { name, email, phoneNumber, password, employeeId, shift } = req.body;

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


    const existingReceptionEmail = await Reception.findOne({ email });
    if (existingReceptionEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingReceptionPhone = await Reception.findOne({ phoneNumber });
    if (existingReceptionPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    
    const newReception = new Reception({
      name,
      email,
      phoneNumber,
      password,
      employeeId,
      shift,
    });

    await newReception.save();

   
    const accessToken = newReception.generateAccessToken();
    const refreshToken = newReception.generateRefreshToken();

    res.status(201).json({
      message: "Reception registered successfully",
      reception: {
        id: newReception._id,
        name: newReception.name,
        email: newReception.email,
        phoneNumber: newReception.phoneNumber,
        employeeId: newReception.employeeId,
        shift: newReception.shift,
        role: newReception.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerReception:", error);


    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    res.status(500).json({ message: "Server error" });
  }
};

// ====== Login Reception ======
const loginReception = async (req, res) => {
  const { email, password } = req.body;

  try {
    
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

  
    const reception = await Reception.findOne({ email });
    if (!reception) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   
    const isMatch = await reception.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   
    const accessToken = reception.generateAccessToken();
    const refreshToken = reception.generateRefreshToken();

    res.status(200).json({
      message: "Login successful",
      reception: {
        id: reception._id,
        name: reception.name,
        email: reception.email,
        phoneNumber: reception.phoneNumber,
        employeeId: reception.employeeId,
        shift: reception.shift,
        role: reception.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginReception:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ====== Get All Receptions ======
const allReceptions = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // Search filter
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } }, // case-insensitive search
        { phoneNumber: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } }
      ];
    }

    // Count total documents
    const total = await Reception.countDocuments(query);

    // Pagination + sorting (newest first)
    const receptions = await Reception.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      receptions
    });
  } catch (error) {
    console.error("Error fetching receptions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching receptions",
    });
  }
};

// ====== Fetch Reception By ID ======
const fetchReceptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const reception = await Reception.findById(id);
    if (!reception) {
      return res.status(404).json({
        success: false,
        message: "Reception not found",
      });
    }

    res.status(200).json({
      success: true,
      reception,
    });
  } catch (error) {
    console.error("Error fetching reception by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reception by ID",
    });
  }
};

export { registerReception, loginReception, allReceptions, fetchReceptionById };
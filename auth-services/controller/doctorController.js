import Doctor from "../models/doctorSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
const generateDoctorId = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit random
  return `DCS-DR-${randomNum}`;
};
// ====== Register Doctor ======
const registerDoctor = async (req, res) => {
  const { name, email, phoneNumber, password, specialization } = req.body;

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


    const existingDoctorEmail = await Doctor.findOne({ email });
    if (existingDoctorEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingDoctorPhone = await Doctor.findOne({ phoneNumber });
    if (existingDoctorPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    let uniqueId;
    let exists = true;
    while (exists) {
      uniqueId = generateDoctorId();
      exists = await Doctor.findOne({ uniqueId });
    }
    const newDoctor = new Doctor({
      name,
      email,
      phoneNumber,
      password,
      specialization,
      uniqueId
    });

    await newDoctor.save();

   
    const accessToken = newDoctor.generateAccessToken();
    const refreshToken = newDoctor.generateRefreshToken();

    res.status(201).json({
      message: "Doctor registered successfully",
      doctor: {
        id: newDoctor._id,
        name: newDoctor.name,
        email: newDoctor.email,
        phoneNumber: newDoctor.phoneNumber,
        specialization: newDoctor.specialization,
        role: newDoctor.role,
        uniqueId:newDoctor.uniqueId
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

// ====== Login Doctor ======
const loginDoctor = async (req, res) => {
  const { email, password } = req.body;

  try {
    
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

  
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   
    const isMatch = await doctor.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   
    const accessToken = doctor.generateAccessToken();
    const refreshToken = doctor.generateRefreshToken();

    res.status(200).json({
      message: "Login successful",
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phoneNumber: doctor.phoneNumber,
        specialization: doctor.specialization,
        role: doctor.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginDoctor:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// unckecked api
const allDoctors = async (req, res) => {
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
    const total = await Doctor.countDocuments(query);

    // Pagination + sorting (newest first)
    const doctors = await Doctor.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      doctors
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctors",
    });
  }
};
 const fetchDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id);
    if (!doctor) {
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
const fetchDoctorByUniqueId = async (req, res) => {
  try {
    const {id: uniqueId } = req.params;

    const doctor = await Doctor.findOne({ uniqueId });
    if (!doctor) {
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
    console.error("Error fetching doctor by uniqueId:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctor by uniqueId",
    });
  }
};

export { registerDoctor, loginDoctor ,allDoctors,fetchDoctorById,fetchDoctorByUniqueId};

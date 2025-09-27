import Doctor from "../models/doctorSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";

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

    
    const newDoctor = new Doctor({
      name,
      email,
      phoneNumber,
      password,
      specialization,
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

export { registerDoctor, loginDoctor };

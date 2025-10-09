import bcrypt from "bcrypt";
import LabUser from "../model/LabUserSchema.js";
import Lab from "../model/LabVendor.js";
import jwt from "jsonwebtoken";

const registerLabUser = async (req, res) => {
  try {
    const { name, email, password, labId } = req.body;

    if (!name || !email || !password || !labId) {
      return res.status(400).json({ message: "Name, email, password, and labId are required" });
    }

    const existing = await LabUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    const lab = await Lab.findById(labId);
    if (!lab) {
      return res.status(404).json({ message: "Invalid labId" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new LabUser({
      name,
      email,
      password: hashedPassword,
      labId,
      clinicId: lab.clinicId,
    });

    await newUser.save();

    // ✅ Create token
    const token = jwt.sign(
      {
        id: newUser._id,
        role: newUser.role,
        labId: newUser.labId,
        clinicId: newUser.clinicId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Lab user registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        labId: newUser.labId,
        clinicId: newUser.clinicId,
      },
    });
  } catch (error) {
    console.error("Register Lab User Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

const labStaffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await LabUser.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 2️⃣ Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    // 3️⃣ Check if user is assigned to a lab
    if (!user.labId) {
      return res
        .status(403)
        .json({ message: "You are not assigned to any lab" });
    }

    // 4️⃣ Optional: verify lab is active
    const lab = await Lab.findById(user.labId);
    if (!lab || !lab.isActive) {
      return res.status(403).json({ message: "Your lab is inactive or missing" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role, // "labstaff"
        labId: user.labId,
        clinicId: user.clinicId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        labId: user.labId,
        clinicId: user.clinicId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export {registerLabUser, labStaffLogin};
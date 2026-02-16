import jwt from "jsonwebtoken";
import EcommerceUser from "../models/EcommerceUserSchema.js";
import Clinic from "../models/clinicSchema.js";
import {
  emailValidator,
  passwordValidator,
  nameValidator,
  phoneValidator,
} from "../utils/validators.js";

const registerEcommerceUser = async (req, res) => {
  try {
    const { name, email, password, phoneNumber, role } = req.body;
    if (!nameValidator(name))
      return res.status(400).json({ message: "Invalid name" });
    if (!emailValidator(email))
      return res.status(400).json({ message: "Invalid email" });
    if (!passwordValidator(password))
      return res.status(400).json({ message: "Invalid password" });
    if (!phoneValidator(phoneNumber))
      return res.status(400).json({ message: "Invalid phone number" });

    const existingUser = await EcommerceUser.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    if (existingUser) {
      if (existingUser.email === email)
        return res.status(400).json({ message: "Email already exists" });
      else
        return res.status(400).json({ message: "Phone number already exists" });
    }

    // Create user
    const newSuperAdmin = new EcommerceUser({
      name,
      email,
      password,
      phoneNumber,
      role
    });
    await newSuperAdmin.save();

    const accessToken = newSuperAdmin.generateAccessToken();
    const refreshToken = newSuperAdmin.generateRefreshToken();

    res.status(201).json({
      message: "User registered successfully",
      superAdmin: {
        id: newSuperAdmin._id,
        name: newSuperAdmin.name,
        email: newSuperAdmin.email,
        phoneNumber: newSuperAdmin.phoneNumber,
        role: newSuperAdmin.role
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({ message: `${duplicateField} already exists` });
    }
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const loginEcommerceUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!emailValidator(email))
      return res.status(400).json({ message: "Invalid email" });
    if (!passwordValidator(password))
      return res.status(400).json({ message: "Invalid password" });

    const superAdmin = await EcommerceUser.findOne({ email });
    if (!superAdmin)
      return res
        .status(401)
        .json({ message: "Email or password is incorrect" });

    const isMatch = await superAdmin.isPasswordCorrect(password);
    if (!isMatch)
      return res
        .status(401)
        .json({ message: "Email or password is incorrect" });

    const accessToken = superAdmin.generateAccessToken();
    const refreshToken = superAdmin.generateRefreshToken();

    // 🔐 ACCESS TOKEN COOKIE
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      // maxAge: 25 * 60 * 1000, 
    });

    // 🔁 REFRESH TOKEN COOKIE
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      // maxAge: 7 * 24 * 60 * 60 * 1000,   
    });

    res.status(200).json({
      message: "Login successful",
      superAdmin: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        phoneNumber: superAdmin.phoneNumber,
        role: superAdmin.role
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const clinicMarketplaceLogin = async (req, res) => {
  try {
    console.log("AUTH HEADER:", req.headers.authorization);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Clinic token missing" });
    }

    const clinicToken = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      clinicToken,
      process.env.ACCESS_TOKEN_SECRET
    );

    const clinic = await Clinic.findById(decoded.clinicId);

    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    let user = await EcommerceUser.findOne({ email: clinic.email });

    if (!user) {
      user = await EcommerceUser.create({
        name: clinic.name,
        email: clinic.email,
        isClinicUser: true
      });
    }

    const ecommerceToken = jwt.sign(
      {
        id: user._id,
        role: "clinic"
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("accessToken", ecommerceToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({ success: true });

  } catch (err) {
    console.error("SSO error:", err);
    res.status(401).json({ message: "Invalid clinic token" });
  }
};


const getProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user.clinicId; // from JWT
    console.log("User ID from token:", userId);
    console.log("Full user object from token:", req.user);

    // First try to find in EcommerceUser collection
    let user = await EcommerceUser.findById(userId).select(
      "-password -refreshToken",
    );
    console.log("EcommerceUser found:", user ? "Yes" : "No");

    let userType = 'ecommerce';

    // If not found in EcommerceUser, try Clinic collection
    if (!user) {
      user = await Clinic.findById(userId).select(
        "-password -refreshToken",
      );
      console.log("Clinic found:", user ? "Yes" : "No");
      userType = 'clinic';
    }

    if (!user) {
      console.log("User not found in either collection");
      return res.status(404).json({ message: "User not found" });
    }

    // Format response based on user type
    let responseData = {};

    if (userType === 'ecommerce') {
      responseData = {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        DOB: user.DOB,
        specialization: user.specialization,
        clinicName: user.clinicName,
        licenseNumber: user.licenseNumber,
        userType: 'ecommerce',
        // ... other ecommerce user fields
      };
    } else {
      // Clinic user - map clinic fields to match frontend expectations
      responseData = {
        id: user._id,
        name: user.clinicName || user.name || '',
        email: user.email || '',
        phoneNumber: user.phone || user.phoneNumber || '',
        DOB: '', // Clinics might not have DOB
        specialization: user.specialization || '',
        clinicName: user.clinicName || user.name || '',
        licenseNumber: user.licenseNumber || '',
        userType: 'clinic',
        // ... other clinic fields
      };
    }

    return res.status(200).json({
      message: "Fetched Profile Details",
      data: responseData,
      userType: userType
    });

  } catch (error) {
    console.error("Error in getProfile:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const editUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ from auth middleware

    const {
      name,
      phoneNumber,
      DOB,
      specialization,
      clinicName,
      licenseNumber,
    } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (DOB) updateData.DOB = DOB;
    if (specialization) updateData.specialization = specialization;
    if (clinicName) updateData.clinicName = clinicName;
    if (licenseNumber) updateData.licenseNumber = licenseNumber;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No fields provided to update",
      });
    }

    const updatedUser = await EcommerceUser.findByIdAndUpdate(
      userId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const logoutUser = (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.json({ message: "Logged out successfully" });
};

export { registerEcommerceUser, loginEcommerceUser, clinicMarketplaceLogin, getProfile, editUserProfile, logoutUser };

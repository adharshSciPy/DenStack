import Patient from "../model/patientSchema.js";
import axios from "axios";
import dotenv from "dotenv";
import { emailValidator, passwordValidator, nameValidator, phoneValidator } from "../utils/validator.js";
dotenv.config();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;

const registerPatient = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const {
      receptionistId,
      name,
      phone,
      email,
      password,
      age,
      gender,
      medicalHistory
    } = req.body;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    if (!receptionistId) {
      return res.status(400).json({ success: false, message: "Receptionist ID is required" });
    }

    if (!name || !nameValidator(name)) {
      return res.status(400).json({ success: false, message: "Invalid name. Must be 2-50 characters." });
    }

    if (!phone || !phoneValidator(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number. Must be 10 digits starting with 6-9." });
    }

    if (email && !emailValidator(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    if (password && !passwordValidator(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8-64 chars, include uppercase, lowercase, number, and special char."
      });
    }

    if (age && (age < 0 || age > 150)) {
      return res.status(400).json({ success: false, message: "Invalid age." });
    }

    if (gender && !["Male", "Female", "Other"].includes(gender)) {
      return res.status(400).json({ success: false, message: "Invalid gender value." });
    }

    // Validate receptionist in another service
    try {
      const receptionRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/receptionist/details/${receptionistId}`);
      if (!receptionRes?.data?.success || !receptionRes?.data?.reception) {
        return res.status(404).json({ success: false, message: "Receptionist not found" });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: "Error validating receptionist", error: err.message });
    }

    // Check if a patient with the same phone already exists in this clinic
    let parentPatient = await Patient.findOne({ clinicId, phone });

    // Create new patient
    const newPatient = new Patient({
      clinicId,
      name,
      phone,
      email,
      password,
      age,
      gender,
      medicalHistory,
      createdBy: receptionistId,
      parentPatient: parentPatient?._id || null
    });

    await newPatient.save();

    // If parent exists, add this patient to parent's linkedPatients
    if (parentPatient) {
      parentPatient.linkedPatients = parentPatient.linkedPatients || [];
      parentPatient.linkedPatients.push(newPatient._id);
      await parentPatient.save();
    }

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      patient: newPatient,
    });

  } catch (error) {
    console.error("Error registering patient:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while registering patient",
      error: error.message,
    });
  }
};

export{registerPatient}
import Patient from "../model/patientSchema.js";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
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
const getPatientWithUniqueId = async (req, res) => {
  const { id: uniqueId } = req.body;

  if (!uniqueId) {
    return res.status(400).json({ success: false, message: "Unique ID is required" });
  }

  try {
    const patient = await Patient.findOne({ patientUniqueId: uniqueId })


    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const getAllPatients = async (req, res) => {
  const { id: clinicId } = req.params;

  try {
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing clinicId" });
    }

    const {
      limit = "10",
      afterId,
      sortBy = "createdAt",
      sortOrder = "desc",
      fields,
      search,
      phone,
      patientUniqueId,
      includeTotal = "false",
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100); // max 100
    const includeCount = String(includeTotal).toLowerCase() === "true";

    // Base query
    const query = { clinicId: new mongoose.Types.ObjectId(clinicId) };

    // Filters
    if (phone) {
      const cleaned = String(phone).replace(/\D/g, "");
      if (/^\d{10}$/.test(cleaned)) query.phone = Number(cleaned);
    }
    if (patientUniqueId) query.patientUniqueId = patientUniqueId;

    // Prefix search (index-friendly)
    if (search) {
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const s = esc(search);
      // Only use regex on 'name' (indexed) or 'patientUniqueId'
      query.$or = [
        { name: { $regex: "^" + s, $options: "i" } },
        { patientUniqueId: { $regex: "^" + s, $options: "i" } },
      ];
    }

    // Projection: default exclude sensitive fields
    const projection = {};
    if (fields) {
      fields.split(",").map(f => f.trim()).forEach(f => {
        if (f) projection[f] = 1;
      });
    }
    projection.password = 0;
    projection.__v = 0;

    // Sort
    const sortDir = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const sortField = sortBy || "createdAt";
    const sort = { [sortField]: sortDir };

    // Cursor pagination
    if (afterId) {
      if (!mongoose.Types.ObjectId.isValid(afterId)) {
        return res.status(400).json({ success: false, message: "Invalid cursor id" });
      }
      const objectCursor = new mongoose.Types.ObjectId(afterId);
      query._id = { $gt: objectCursor }; // always fetch documents after this _id
    }

    // Fetch documents + 1 extra to detect "hasMore"
    const docs = await Patient.find(query)
      .sort({ _id: sortDir }) // sort by _id for stable cursor pagination
      .limit(parsedLimit + 1)
      .select(projection)
      .lean();

    const hasMore = docs.length > parsedLimit;
    if (hasMore) docs.pop(); // remove extra doc

    const nextCursor = docs.length ? String(docs[docs.length - 1]._id) : null;

    const meta = {
      mode: "cursor",
      limit: parsedLimit,
      nextCursor,
      hasMore,
    };

    // Include total count only if explicitly requested
    if (includeCount) {
      meta.total = await Patient.countDocuments(query);
    }

    return res.json({ success: true, meta, data: docs });
  } catch (err) {
    console.error("getAllPatients error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
const patientCheck = async (req, res) => {
  try {
    const { clinicId, patientId } = req.body;

    // Validate IDs
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid patientId" });
    }

    // Efficient lookup
    const patient = await Patient.findOne(
      { _id: patientId, clinicId },
      { _id: 1, name: 1, patientUniqueId: 1 } // only fetch minimal fields
    ).lean();

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found in this clinic" });
    }

    res.status(200).json({
      success: true,
      message: "Patient exists in the clinic",
      data: patient
    });

  } catch (error) {
    console.error("Patient verify error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const getPatientsByClinic = async (req ,res) => {
  try {
    const { id: clinicId } = req.params;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    const patients = await Patient.find({ clinicId }).lean();

    return res.status(200).json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    console.error("getPatientsByClinic error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export{registerPatient,getPatientWithUniqueId,getAllPatients,patientCheck,getPatientsByClinic}
import Patient from "../model/patientSchema.js";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { emailValidator, passwordValidator, nameValidator, phoneValidator } from "../utils/validator.js";
import crypto from "crypto";
import twilio from "twilio";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import PatientHistory from "../model/patientHistorySchema.js";
import Appointment from "../model/appointmentSchema.js";
import TreatmentPlan from "../model/treatmentPlanSchema.js";

dotenv.config();
const AUTH_SERVICE_BASE_URL = process.env.AUTH_SERVICE_BASE_URL;

const registerPatient = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const {
      userId,        // Logged-in user ID (Admin or Receptionist)
      userRole,      // "admin" or "receptionist"
      name,
      phone,
      email,
      password,
      age,
      gender,
      medicalHistory,
    } = req.body;

    // 1️⃣ Validate Clinic ID
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing clinicId" });
    }

    // 2️⃣ Validate Creator Info
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing userId" });
    }

    if (!userRole || !["receptionist", "admin"].includes(userRole)) {
      return res.status(400).json({ success: false, message: "Invalid userRole. Must be receptionist or admin." });
    }

    // 3️⃣ Validate Name and Phone
    if (!name || !nameValidator(name)) {
      return res.status(400).json({ success: false, message: "Invalid name. Must be 2–50 characters." });
    }

    if (!phone || !phoneValidator(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number. Must be 10 digits starting with 6–9." });
    }

    // 4️⃣ Optional Validations
    if (email && !emailValidator(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    if (password && !passwordValidator(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8–64 chars, include uppercase, lowercase, number, and special char.",
      });
    }

    if (age && (age < 0 || age > 150)) {
      return res.status(400).json({ success: false, message: "Invalid age." });
    }

    if (gender && !["Male", "Female", "Other"].includes(gender)) {
      return res.status(400).json({ success: false, message: "Invalid gender value." });
    }

    // 5️⃣ Verify the creator based on role
    try {
      if (userRole === "receptionist") {
        const staffRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic/all-staffs/${clinicId}`);
        const staff = staffRes.data?.staff;

        if (!staff || !staff.receptionists)
          return res.status(404).json({ success: false, message: "Clinic staff data unavailable." });

        const isReceptionist = staff.receptionists.some(
          (rec) => rec._id.toString() === userId.toString()
        );
        if (!isReceptionist)
          return res.status(403).json({ success: false, message: "Receptionist does not belong to this clinic." });
      } 
        // else if (userRole === "admin") {
        //   const adminRes = await axios.get(`${AUTH_SERVICE_BASE_URL}/clinic-admin/details/${userId}`);
        //   if (!adminRes?.data?.success || !adminRes?.data?.admin)
        //     return res.status(404).json({ success: false, message: "Clinic admin not found." });
        // }
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error validating creator in Auth Service.",
        error: err.response?.data?.message || err.message,
      });
    }

    // 6️⃣ Check if patient already exists in this clinic
    let parentPatient = await Patient.findOne({ clinicId, phone });

    // 7️⃣ Create new patient
    const newPatient = new Patient({
      clinicId,
      name,
      phone,
      email,
      password,
      age,
      gender,
      medicalHistory,
      createdBy: userId,
      createdByRole: userRole.charAt(0).toUpperCase() + userRole.slice(1), // Admin or Receptionist
      parentPatient: parentPatient?._id || null,
    });

    await newPatient.save();

    // 8️⃣ Link to parent if exists
    if (parentPatient) {
      parentPatient.linkedPatients = parentPatient.linkedPatients || [];
      parentPatient.linkedPatients.push(newPatient._id);
      await parentPatient.save();
    }

    // ✅ Success Response
    return res.status(201).json({
      success: true,
      message: "Patient registered successfully.",
      patient: newPatient,
    });

  } catch (error) {
    console.error("❌ Error registering patient:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while registering patient.",
      error: error.message,
    });
  }
};
const getPatientWithUniqueId = async (req, res) => {
  const { id: uniqueId, clinicId } = req.query;

  if (!uniqueId || !clinicId) {
    return res.status(400).json({ success: false, message: "Unique ID and Clinic ID are required" });
  }

  try {
    const patient = await Patient.findOne({ patientUniqueId: uniqueId, clinicId });

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found for this clinic" });
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
const getPatientsByClinic = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const { search } = req.query;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    const query = { clinicId };

    // Search only starting letters of the name
    if (search) {
      query.name = { $regex: `^${search}`, $options: "i" };
    }

    const patients = await Patient.find(query).lean();

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    console.error("getPatientsByClinic error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
const getPatientById = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: " ID is required" });
  }

  try {
    const patient = await Patient.findById(id)


    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const sendSMSLink = async (req, res) => {
  try {
    const { phone } = req.body;

    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    patient.otpToken = token;
    patient.otpTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min validity
    await patient.save();

    const link = `https://yourfrontend.com/set-password/${token}`;

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: `+91${phone}`,
      body: `Click this secure link to set your password: ${link} (valid for 10 minutes)`,
    });

    res.json({ success: true, message: "Secure link sent via SMS" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send link" });
  }
};
const setPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const patient = await Patient.findOne({
      otpToken: token,
      otpTokenExpiry: { $gt: new Date() },
    }).select("+otpToken +otpTokenExpiry");

    if (!patient) {
      return res.status(400).json({ success: false, message: "Invalid or expired link" });
    }

    // Hash new password
    const hashed = await bcrypt.hash(password, 10);
    patient.password = hashed;
    patient.otpToken = undefined;
    patient.otpTokenExpiry = undefined;
    await patient.save();

    const authToken = jwt.sign(
      { id: patient._id, role: patient.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token: authToken, message: "Password set successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error setting password" });
  }
};
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const patient = await Patient.findOne({ phone }).select("+password");
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const valid = await bcrypt.compare(password, patient.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: patient._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
const getPatientByRandomId = async (req, res) => {
  try {
    const { id: randomId } = req.params;

    if (!randomId) {
      return res.status(400).json({ success: false, message: "Random ID is required" });
    }

    const patients = await Patient.find(
      { patientRandomId: randomId },
      {
        name: 1,
        phone: 1,
        email: 1,
        age: 1,
        gender: 1,
        clinicId: 1,
        patientUniqueId: 1,
        dentalChart: 1
      }
    ).lean();

    if (!patients.length) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const patientIds = patients.map(p => p._id);

    const visitCounts = await PatientHistory.aggregate([
      { $match: { patientId: { $in: patientIds } } },
      { $group: { _id: "$patientId", count: { $sum: 1 } } }
    ]);

    const visitCountMap = visitCounts.reduce((acc, v) => {
      acc[v._id.toString()] = v.count;
      return acc;
    }, {});

    const response = patients.map(p => ({
      patientId: p._id,
      clinicId: p.clinicId,
      patientUniqueId: p.patientUniqueId,
      profile: p,
      dentalChart: p.dentalChart || [],
      totalVisits: visitCountMap[p._id.toString()] || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        visitCount:visitCounts,
        patientRandomId: randomId,
        records: response
        
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//to patch laborders to patient model
const addLabOrderToPatient = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const { labOrderId } = req.body;

    // Validate Patient ID
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid patient ID" });
    }

    // Validate lab order ID
    if (!labOrderId || !mongoose.Types.ObjectId.isValid(labOrderId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing labOrderId" });
    }

    // Push labOrderId into labHistory array (avoid duplicates)
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      { $addToSet: { labHistory: labOrderId } }, // avoids duplicates
      { new: true }
    ).populate("labHistory");

    if (!updatedPatient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Lab order added to patient successfully",
      labHistory: updatedPatient.labHistory,
    });

  } catch (error) {
    console.error("Error adding lab order to patient:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating patient",
      error: error.message,
    });
  }
};
const getPatientFullCRM = async (req, res) => {
  const { uniqueId, clinicId } = req.query;

  if (!uniqueId || !clinicId) {
    return res.status(400).json({
      success: false,
      message: "patientUniqueId and clinicId are required",
    });
  }

  try {
    /* ================== 1️⃣ PATIENT ================== */
    const patient = await Patient.findOne(
      { patientUniqueId: uniqueId, clinicId },
      {
        password: 0,
        otpToken: 0,
        otpTokenExpiry: 0,
        __v: 0,
      }
    ).lean();

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const patientId = patient._id;

    /* ================== 2️⃣ VISITS / APPTS / PLANS ================== */
    const [visitHistory, appointments, treatmentPlans] = await Promise.all([
      PatientHistory.find({ patientId, clinicId })
        .sort({ visitDate: -1 })
        .lean(),

      Appointment.find(
        { patientId, clinicId },
        {
          appointmentDate: 1,
          appointmentTime: 1,
          status: 1,
          department: 1,
          doctorId: 1,
        }
      )
        .sort({ appointmentDate: -1 })
        .lean(),

      TreatmentPlan.find({ patientId, clinicId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    /* ================== 3️⃣ SUMMARY ================== */
    const summaryAgg = await PatientHistory.aggregate([
      {
        $match: {
          patientId,
          clinicId: new mongoose.Types.ObjectId(clinicId),
        },
      },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          unpaidAmount: {
            $sum: {
              $cond: [{ $eq: ["$isPaid", false] }, "$totalAmount", 0],
            },
          },
        },
      },
    ]);

    const summary = Object.freeze({
      totalVisits: summaryAgg[0]?.totalVisits || 0,
      totalSpent: summaryAgg[0]?.totalSpent || 0,
      unpaidAmount: summaryAgg[0]?.unpaidAmount || 0,
      activeTreatmentPlans: treatmentPlans.filter(
        t => t.status === "ongoing"
      ).length,
    });

    /* ================== 4️⃣ DOCTOR ENRICH ================== */
    const doctorIds = new Set();

    visitHistory.forEach(v => {
      if (v.doctorId) doctorIds.add(v.doctorId.toString());
      if (v.createdBy) doctorIds.add(v.createdBy.toString());
      if (v.updatedBy) doctorIds.add(v.updatedBy.toString());
    });

    appointments.forEach(a => {
      if (a.doctorId) doctorIds.add(a.doctorId.toString());
    });

    treatmentPlans.forEach(t => {
      if (t.createdByDoctorId)
        doctorIds.add(t.createdByDoctorId.toString());
    });

    const doctorResponses = await Promise.all(
      [...doctorIds].map(async id => {
        try {
          const { data } = await axios.get(
            `${AUTH_SERVICE_BASE_URL}/doctor/details/${id}`,
            { timeout: 3000 }
          );
          return [id, data?.data ? { _id: id, name: data.data.name } : null];
        } catch {
          return [id, null];
        }
      })
    );

    const doctorMap = {};
    doctorResponses.forEach(([id, doctor]) => {
      doctorMap[id] = doctor;
    });

    const getDoctor = id => (id ? doctorMap[id.toString()] || null : null);

    visitHistory.forEach(v => {
      v.doctor = getDoctor(v.doctorId);
      v.createdByDoctor = getDoctor(v.createdBy);
      v.updatedByDoctor = getDoctor(v.updatedBy);
    });

    appointments.forEach(a => {
      a.doctor = getDoctor(a.doctorId);
    });

    treatmentPlans.forEach(t => {
      t.createdByDoctor = getDoctor(t.createdByDoctorId);
    });

    /* ================== 5️⃣ MERGED DENTAL CHART ================== */
    const dentalChart = visitHistory
      .flatMap(v => v.dentalChart || [])
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt)
      );

    /* ================== 6️⃣ FINAL RESPONSE ================== */
    return res.status(200).json({
      success: true,
      data: {
        patientProfile: {
          _id: patient._id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          gender: patient.gender,
          age: patient.age,
          bloodGroup: patient.bloodGroup,
          dateOfBirth: patient.dateOfBirth,
          height: patient.height,
          weight: patient.weight,
          address: patient.address,
          emergencyContact: patient.emergencyContact,
          patientUniqueId: patient.patientUniqueId,
          patientRandomId: patient.patientRandomId,
          createdAt: patient.createdAt,
        },

        medicalHistory: {
          conditions: patient.medicalHistory?.conditions || [],
          allergies: patient.medicalHistory?.allergies || [],
          surgeries: patient.medicalHistory?.surgeries || [],
          familyHistory: patient.medicalHistory?.familyHistory || [],
        },

        dentalChart,
        visitHistory,
        appointments,
        treatmentPlans,
        summary,
      },
    });
  } catch (error) {
    console.error("CRM Fetch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching patient CRM",
    });
  }
};
const updatePatientDetails = async (req, res) => {
  try {
    const { id:patientId } = req.params;

    const updates = req.body;

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: updates
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Patient details updated successfully",
      data: patient
    });

  } catch (error) {
    console.error("❌ Update patient error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
 const getAllPatientsWithBirthdays = async (req, res) => {
  try {
    // Fetch all patients that have a dateOfBirth
    const patients = await Patient.find({
      dateOfBirth: { $exists: true, $ne: null }
    })
    .select('name phone email dateOfBirth clinicId patientUniqueId _id')
    .lean();
    
    return res.status(200).json({
      success: true,
      data: patients,
      count: patients.length
    });
  } catch (error) {
    console.error('Error fetching patients with birthdays:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching patients',
      error: error.message
    });
  }
};
const getPatientDentalChart = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID"
      });
    }
    
    // Get patient with dental chart only
    const patient = await Patient.findById(patientId)
      .select('name age gender dateOfBirth dentalChart patientUniqueId')
      .lean();
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }
    
    // Determine age group based on age or dateOfBirth
    let ageGroup = 'adult'; // Default
    let calculatedAge = patient.age;
    
    // If no age but has dateOfBirth, calculate age
    if (!patient.age && patient.dateOfBirth) {
      const birthDate = new Date(patient.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      calculatedAge = age;
    }
    
    // Pediatric typically up to 18 years
    if (calculatedAge !== undefined && calculatedAge <= 18) {
      ageGroup = 'pediatric';
    }
    
    // Determine tooth type based on age group
    const toothType = ageGroup === 'pediatric' ? 'primary' : 'permanent';
    
    // Filter and process dental chart
    const dentalChart = [];
    const seenTeeth = new Set(); // To avoid duplicates
    
    if (patient.dentalChart && Array.isArray(patient.dentalChart)) {
      // Process each tooth entry
      patient.dentalChart.forEach(tooth => {
        const toothNum = tooth.toothNumber;
        
        // Skip if we've already processed this tooth (safety check)
        if (seenTeeth.has(toothNum)) {
          console.log(`⚠️ Skipping duplicate tooth ${toothNum} for patient ${patientId}`);
          return;
        }
        
        seenTeeth.add(toothNum);
        
        // Format the tooth data
        const toothData = {
          toothNumber: toothNum,
          toothType: toothType,
          ageGroup: ageGroup,
          conditions: tooth.conditions || [],
          surfaceConditions: tooth.surfaceConditions || [],
          procedures: tooth.procedures || [],
          lastUpdated: tooth.lastUpdated || tooth.updatedAt || tooth.createdAt,
          lastUpdatedBy: tooth.lastUpdatedBy,
          lastVisitId: tooth.lastVisitId
        };
        
        dentalChart.push(toothData);
      });
    }
    
    // Sort by tooth number
    dentalChart.sort((a, b) => a.toothNumber - b.toothNumber);
    
    // Calculate summary statistics
    const teethWithConditions = dentalChart.filter(tooth => 
      tooth.conditions.length > 0 || 
      tooth.surfaceConditions.length > 0
    ).length;
    
    const teethWithProcedures = dentalChart.filter(tooth => 
      tooth.procedures.length > 0
    ).length;
    
    const totalProcedures = dentalChart.reduce((sum, tooth) => 
      sum + tooth.procedures.length, 0
    );
    
    const plannedProcedures = dentalChart.reduce((sum, tooth) => 
      sum + tooth.procedures.filter(p => p.status === 'planned').length, 0
    );
    
    const completedProcedures = dentalChart.reduce((sum, tooth) => 
      sum + tooth.procedures.filter(p => p.status === 'completed').length, 0
    );
    
    // Get all unique conditions for quick overview
    const allConditions = new Set();
    const allProcedureTypes = new Set();
    
    dentalChart.forEach(tooth => {
      tooth.conditions.forEach(cond => allConditions.add(cond));
      tooth.surfaceConditions.forEach(sc => 
        sc.conditions.forEach(cond => allConditions.add(cond))
      );
      tooth.procedures.forEach(proc => allProcedureTypes.add(proc.name));
    });
    
    // Format last updated date
    const lastUpdated = dentalChart.length > 0 
      ? dentalChart.reduce((latest, tooth) => {
          const toothDate = new Date(tooth.lastUpdated);
          return toothDate > latest ? toothDate : latest;
        }, new Date(0))
      : null;
    
    return res.status(200).json({
      success: true,
      data: {
        patient: {
          id: patientId,
          name: patient.name,
          age: calculatedAge,
          ageGroup: ageGroup,
          gender: patient.gender,
          patientUniqueId: patient.patientUniqueId
        },
        dentalChart: dentalChart,
        summary: {
          totalTeeth: dentalChart.length,
          teethWithConditions,
          teethWithProcedures,
          totalProcedures,
          plannedProcedures,
          completedProcedures,
          uniqueConditions: Array.from(allConditions),
          uniqueProcedureTypes: Array.from(allProcedureTypes),
          lastUpdated: lastUpdated,
          chartAgeGroup: ageGroup,
          toothType: toothType
        },
        metadata: {
          source: 'patient_document',
          toothMapping: toothType === 'primary' ? 'primary_teeth' : 'permanent_teeth',
          note: 'Dental chart fetched directly from patient document. No duplicates allowed.',
          validation: {
            duplicateTeethChecked: true,
            ageGroupValidated: true,
            toothTypeAssigned: true
          }
        }
      }
    });
    
  } catch (error) {
    console.error("getPatientDentalChart error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching dental chart",
      error: error.message
    });
  }
};
const getVisitHistory = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const { cursor, cursorId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID",
      });
    }

    const query = {
      patientId: new mongoose.Types.ObjectId(patientId),
    };

    // FIXED CURSOR LOGIC: Handle multiple documents with same visitDate
    if (cursor && cursorId) {
      const cursorDate = new Date(cursor);
      query.$or = [
        { visitDate: { $lt: cursorDate } },
        { 
          visitDate: cursorDate,
          _id: { $lt: new mongoose.Types.ObjectId(cursorId) }
        }
      ];
    }

    // Fetch ALL fields by not specifying projection, OR explicitly include all needed fields
  const visits = await PatientHistory.find(query)
  .sort({ visitDate: -1, _id: -1 })
  .limit(limit + 1)
  .lean();


    const hasNextPage = visits.length > limit;
    const data = hasNextPage ? visits.slice(0, limit) : visits;

    // Get last item for cursor - FIXED: check if data exists
    const lastItem = data.length > 0 ? data[data.length - 1] : null;

    res.status(200).json({
      success: true,
      data,
      nextCursor: hasNextPage && lastItem
        ? {
            visitDate: lastItem.visitDate,
            _id: lastItem._id,
          }
        : null,
      hasNextPage,
      total: data.length,
    });
  } catch (error) {
    console.error("getVisitHistory error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export { registerPatient, getPatientWithUniqueId, getAllPatients, patientCheck, getPatientsByClinic, getPatientById, sendSMSLink, setPassword, login,getPatientByRandomId ,addLabOrderToPatient,getPatientFullCRM,updatePatientDetails,getAllPatientsWithBirthdays,getPatientDentalChart,getVisitHistory }
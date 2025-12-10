import Patient from "../model/patientSchema.js";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { emailValidator, passwordValidator, nameValidator, phoneValidator } from "../utils/validator.js";
import crypto from "crypto";
import twilio from "twilio";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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


// export const getPatientById = async (req, res) => {
//   try {
//     const { id } = req.params;  // Gets from URL: /patient/68e496a097514f58b13e6112
    
//     const patient = await Patient.findById(id);  // Finds by MongoDB _id
    
//     if (!patient) {
//       return res.status(404).json({
//         success: false,
//         message: "Patient not found"
//       });
//     }
    
//     res.status(200).json({
//       success: true,
//       patient
//     });
//   } catch (error) {
//     console.error("Error fetching patient:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!randomId)
      return res.status(400).json({ success: false, message: "Random ID is required" });

    const patients = await Patient.find({ patientRandomId: randomId })
      .select("-otpToken -otpTokenExpiry -password")
      .lean();

    if (!patients.length)
      return res.status(404).json({ success: false, message: "Patient not found" });

    const consolidatedResponse = [];
    const clinicCache = {};
    const doctorCache = {};

    for (const patient of patients) {
      // Fetch all visit history for this patient
     const allVisits = await PatientHistory.find({
  patientId: patient._id,
  clinicId: patient.clinicId
})
.sort({ visitDate: -1 })
.lean();


      // Paginate visit history for this clinic
      const totalVisits = allVisits.length;
      const totalPages = Math.ceil(totalVisits / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedVisits = allVisits.slice(startIndex, endIndex);

      // Fetch doctor details for paginated visits
      const doctorIds = [...new Set(paginatedVisits.map(v => v.doctorId).filter(Boolean))];
      await Promise.all(
        doctorIds.map(async (id) => {
          if (!doctorCache[id]) {
            try {
              const { data } = await axios.get(
                `${process.env.AUTH_SERVICE_BASE_URL}/doctor/details/${id}`
              );
              doctorCache[id] = data?.data || null;
            } catch (err) {
              console.warn(`⚠️ Doctor fetch failed ${id}: ${err.message}`);
              doctorCache[id] = null;
            }
          }
        })
      );

      // Fetch treatment plans for paginated visits
      const treatmentPlanIds = [...new Set(paginatedVisits.map(v => v.treatmentPlanId).filter(Boolean))];
      const treatmentPlans = await mongoose.model("TreatmentPlan").find(
        { _id: { $in: treatmentPlanIds } },
        "planName status createdAt completedAt stages"
      ).lean();
      const treatmentPlanMap = treatmentPlans.reduce((acc, plan) => {
        acc[plan._id.toString()] = plan;
        return acc;
      }, {});

      // Fetch clinic details (cache)
      let clinicDetails = clinicCache[patient.clinicId];
      if (!clinicDetails) {
        try {
          const { data } = await axios.get(
            `${process.env.AUTH_SERVICE_BASE_URL}/clinic/view-clinic/${patient.clinicId}?basic=true`
          );
          clinicDetails = data?.data || null;
          clinicCache[patient.clinicId] = clinicDetails;
        } catch (err) {
          console.warn(`Clinic fetch failed ${patient.clinicId}: ${err.message}`);
          clinicDetails = null;
        }
      }

      // Enrich visits with doctor and treatment plan
      const enrichedVisits = paginatedVisits.map(v => ({
        ...v,
        doctor: doctorCache[v.doctorId] || null,
        treatmentPlan: treatmentPlanMap[v.treatmentPlanId?.toString()] || null
      }));

      consolidatedResponse.push({
        clinicId: patient.clinicId,
        clinicDetails,
        patientUniqueId: patient.patientUniqueId,
        patientId: patient._id,
        profile: patient,
        visitHistory: enrichedVisits,
        pagination: {
          page,
          limit,
          totalVisits,
          totalPages
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient data fetched with pagination",
      data: {
        patientRandomId: randomId,
        records: consolidatedResponse
      }
    });

  } catch (err) {
    console.error("getPatientByRandomId error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
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


export { registerPatient, getPatientWithUniqueId, getAllPatients, patientCheck, getPatientsByClinic, getPatientById, sendSMSLink, setPassword, login,getPatientByRandomId ,addLabOrderToPatient}
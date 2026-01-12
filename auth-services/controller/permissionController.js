import Doctor from "../models/doctorSchema.js";
import Nurse from "../models/nurseSchema.js";
import Reception from "../models/receptionSchema.js";
import Accountant from "../models/accountantSchema.js";
import Technician from "../models/technicianSchema.js";
import Pharmacist from "../models/pharmacistSchema.js";
import Assistant from "../models/assistantSchema.js";
import Clinic from "../models/clinicSchema.js";

/* ============================================================
   ROLE NORMALIZATION (VERY IMPORTANT)
============================================================ */
const ROLE_MAP = {
  300: "nurse",
  nurse: "nurse",
  doctor: "doctor",
  500: "receptionist",
  accountant: "accountant",
  technician: "technician",
  pharmacist: "pharmacist",
  assistant: "assistant",
};

const MODEL_MAP = {
  doctor: Doctor,
  nurse: Nurse,
  receptionist: Reception,
  accountant: Accountant,
  technician: Technician,
  pharmacist: Pharmacist,
  assistant: Assistant,
};

/* ============================================================
   🔒 INTERNAL SERVICE AUTH (SERVICE → SERVICE)
============================================================ */
export const verifyInternalService = (req, res, next) => {
  console.log("🔐 RECEIVED x-service-token:", req.headers["x-service-token"]);
  console.log("🔐 EXPECTED token:", process.env.INTERNAL_SERVICE_TOKEN);

  const token = req.headers["x-service-token"];

  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized internal service",
    });
  }

  next();
};

/* ============================================================
   👑 UPDATE PERMISSIONS (CLINIC ADMIN ONLY)
============================================================ */
export const updatePermissions = async (req, res) => {
  try {
    const { staffId, role, permissions } = req.body;

    const resolvedRole = ROLE_MAP[role];
    const Model = MODEL_MAP[resolvedRole];
    if (!Model) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const staff = await Model.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // 🔒 Verify staff belongs to clinic
    const clinic = await Clinic.findById(req.user.clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    const clinicStaffIds = Object.values(clinic.staffs || {})
      .flat()
      .map(id => id.toString());

    if (!clinicStaffIds.includes(staffId)) {
      return res.status(403).json({
        message: "Staff does not belong to this clinic",
      });
    }

    // ✅ Sanitize permissions
    const sanitizedPermissions = {};
    for (const module in permissions) {
      sanitizedPermissions[module] = {
        read: Boolean(permissions[module]?.read),
        write: Boolean(permissions[module]?.write),
      };
    }

    staff.permissions = sanitizedPermissions;
    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Permissions updated successfully",
      permissions: staff.permissions,
    });
  } catch (err) {
    console.error("❌ updatePermissions error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   👑 GET PERMISSIONS (CLINIC ADMIN ONLY)
============================================================ */
export const getPermissions = async (req, res) => {
  try {
    const { staffId, role } = req.query;

    const resolvedRole = ROLE_MAP[role];
    const Model = MODEL_MAP[resolvedRole];
    if (!Model) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const staff = await Model.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const clinic = await Clinic.findById(req.user.clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    const clinicStaffIds = Object.values(clinic.staffs || {})
      .flat()
      .map(id => id.toString());

    if (!clinicStaffIds.includes(staffId)) {
      return res.status(403).json({
        message: "Staff does not belong to this clinic",
      });
    }

    return res.status(200).json({
      success: true,
      permissions: staff.permissions || {},
    });
  } catch (err) {
    console.error("❌ getPermissions error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   🔁 INTERNAL – REAL-TIME PERMISSIONS (PATIENT SERVICE)
============================================================ */
export const getPermissionsInternal = async (req, res) => {
  try {
    const { staffId, role } = req.query;

    const resolvedRole = ROLE_MAP[role];
    const Model = MODEL_MAP[resolvedRole];
    if (!Model) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const staff = await Model.findById(staffId)
      .select("permissions")
      .lean();

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    return res.status(200).json({
      success: true,
      permissions: staff.permissions || {},
    });
  } catch (err) {
    console.error("❌ getPermissionsInternal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   👑 GET ALL STAFF UNDER A CLINIC
============================================================ */
export const getAllClinicStaff = async (req, res) => {
  try {
    const { clinicId } = req.params;

    if (clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: "Unauthorized clinic access" });
    }

    const clinic = await Clinic.findById(clinicId)
      .populate("staffs.nurses", "_id name email phoneNumber")
      .populate("staffs.receptionists", "_id name email phoneNumber")
      .populate("staffs.pharmacists", "_id name email phoneNumber")
      .populate("staffs.accountants", "_id name email phoneNumber")
      .populate("staffs.technicians", "_id name email phoneNumber");

    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    res.status(200).json({
      success: true,
      clinicId,
      staff: clinic.staffs,
    });
  } catch (err) {
    console.error("❌ getAllClinicStaff error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
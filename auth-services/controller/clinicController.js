import Clinic from "../models/clinicSchema.js";
import {
  nameValidator,
  emailValidator,
  passwordValidator,
  phoneValidator,
} from "../utils/validators.js";
import mongoose from "mongoose";
import { config } from "dotenv";
import axios from "axios";
import { response } from "express";
import Pharmacist from "../models/pharmacistSchema.js";
import Nurse from "../models/nurseSchema.js";
import Receptionist from "../models/receptionSchema.js";
import Accountant from "../models/accountantSchema.js";
import Technician from "../models/technicianSchema.js";
import jwt from "jsonwebtoken";
config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL || "http://localhost:8003/api/v1/clinic-service";
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL || "http://localhost:8002/api/v1/patient-service";
const LAB_SERVICE_BASE_URL = process.env.LAB_SERVICE_BASE_URL || "http://localhost:8006";
const formatDate = (dateStr) => {
  const [day, month, year] = dateStr.split("-");
  return new Date(`${year}-${month}-${day}`);
};
const registerClinic = async (req, res) => {
  try {
    const {
      name,
      type,
      email,
      phoneNumber,
      password,
      address,
      description,
      theme,
      features,
      isMultipleClinic = false,
      isOwnLab = false,
      googlePlaceId,
    } = req.body;


    if (!name || !nameValidator(name)) {
      return res.status(400).json({ success: false, message: "Invalid name" });
    }
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    if (!phoneNumber || !phoneValidator(phoneNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }
    if (!password || !passwordValidator(password)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid password" });
    }

    const [existingEmail, existingPhone] = await Promise.all([
      Clinic.findOne({ email }),
      Clinic.findOne({ phoneNumber }),
    ]);
    if (existingEmail)
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    if (existingPhone)
      return res.status(400).json({
        success: false,
        message: "Phone number already exists",
      });


    const newClinic = new Clinic({
      name,
      type,
      email,
      phoneNumber,
      password,
      address,
      description,
      theme,
      isMultipleClinic,
      isOwnLab,
      googlePlaceId
    });

    // 🔹 Default subscription on registration (basic/monthly)
    newClinic.activateSubscription("annual", "starter", 0);

    // 🔹 Apply features based on default package
    newClinic.applySubscriptionFeatures();

    // 🔹 Optionally override feature toggles from request (on/off)
    if (features && typeof features === "object") {
      Object.entries(features).forEach(([key, value]) => {
        if (key in newClinic.features) {
          if (typeof value === "object") {
            // nested object (like canAddStaff)
            Object.entries(value).forEach(([subKey, subVal]) => {
              if (
                newClinic.features[key] &&
                subKey in newClinic.features[key]
              ) {
                newClinic.features[key][subKey] = !!subVal; // enforce boolean
              }
            });
          } else {
            newClinic.features[key] = !!value;
          }
        }
      });
    }

    await newClinic.save();
    const accessToken = newClinic.generateAccessToken();
    const refreshToken = newClinic.generateRefreshToken();
    return res.status(201).json({
      success: true,
      message: "Clinic registered successfully",
      clinic: {
        id: newClinic._id,
        name: newClinic.name,
        email: newClinic.email,
        phoneNumber: newClinic.phoneNumber,
        type: newClinic.type,
        role: newClinic.role,
        subscription: newClinic.subscription,
        features: newClinic.features,
        theme: newClinic.theme,
        isMultipleClinic: newClinic.isMultipleClinic,
        isOwnLab: newClinic.isOwnLab,
        googlePlaceId: newClinic.googlePlaceId,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerClinic:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during clinic registration",
      details: error.message,
    });
  }
};

const loginClinic = async (req, res) => {
  const { email, password } = req.body;

  try {

    // ====== VALIDATIONS ======
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // ====== FIND CLINIC ======
    const clinic = await Clinic.findOne({ email });
    if (!clinic) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ====== VERIFY PASSWORD ======
    const isMatch = await clinic.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!clinic.isActive) {
      return res.status(403).json({
        message: "Your clinic access has been disabled by SuperAdmin."
      });
    }

    // ====== GENERATE TOKENS ======
    const accessToken = clinic.generateAccessToken();
    const refreshToken = clinic.generateRefreshToken();
    let subClinics = [];
    if (clinic.isMultipleClinic) {
      subClinics = await Clinic.find({ parentClinicId: clinic._id })
        .select("_id name email phoneNumber type isOwnLab subscription isActive")
        .lean();
    }

    res.status(200).json({
      message: "Login successful",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        phoneNumber: clinic.phoneNumber,
        type: clinic.type,
        role: clinic.role,
        subscription: clinic.subscription,
        subClinics,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginClinic:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const viewAllClinics = async (req, res) => {
  try {
    let { page, limit } = req.query;

    // Convert to number and set defaults
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;

    // Fetch clinics with pagination
    const clinics = await Clinic.find()
      .skip(skip)
      .limit(limit);

    // Get total count for frontend pagination
    const total = await Clinic.countDocuments();

    res.status(200).json({
      message: "Clinics Fetched Successfully",
      data: clinics,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const viewClinicById = async (req, res) => {
  try {
    const { id } = req.params;
    const { basic } = req.query;

    let clinic;

    // If query "basic" exists → fetch only required fields
    if (basic) {
      clinic = await Clinic.findById(
        id,
        {
          name: 1,
          email: 1,
          phoneNumber: 1
        }
      ).lean();
    } else {
      // full response
      clinic = await Clinic.findById(id).lean();
    }

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Clinic details fetched successfully",
      data: clinic
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const editClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const { name,
      type,
      email,
      phoneNumber,
      address,
      description } = req.body
    const editRes = await Clinic.findByIdAndUpdate(id, {
      name,
      type,
      email,
      phoneNumber,
      address,
      description,
    }, { new: true })
    res.status(200).json({ message: "Clinic updated successfully", data: editRes })
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}
const getClinicStaffs = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const { role, cursor, limit = 10 } = req.query;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    const clinic = await Clinic.findById(clinicId).select("name staffs").lean();
    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // ✅ Role map
    const roleMap = {
      nurse: "nurses",
      receptionist: "receptionists",
      pharmacist: "pharmacists",
      accountant: "accountants",
      technician: "technicians", // 👈 Added technician role
    };

    // ✅ Prepare empty staff object
    const staffResult = {
      nurses: [],
      receptionists: [],
      pharmacists: [],
      accountants: [],
      technicians: [], // 👈 Added technicians array
    };

    // ✅ Model mapping
    const ModelMap = {
      nurse: Nurse,
      receptionist: Receptionist,
      pharmacist: Pharmacist,
      accountant: Accountant,
      technician: Technician, // 👈 Added Technician model
    };

    // ✅ Fetch staff by role
    for (const [key, modelName] of Object.entries(roleMap)) {
      let staffIds = clinic.staffs[modelName] || [];
      let query = { _id: { $in: staffIds } };

      if (role && role !== key) continue; // skip other roles if role filter applied

      if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
        query._id.$lt = cursor;
      }

      const staffData = await ModelMap[key]
        .find(query)
        .sort({ _id: -1 })
        .limit(Number(limit))
        .lean();

      staffResult[modelName] = staffData;
    }

    res.status(200).json({
      success: true,
      message: "Clinic staff fetched successfully",
      clinic: {
        id: clinic._id,
        name: clinic.name,
      },
      staff: staffResult,
    });
  } catch (error) {
    console.error("❌ Error in getClinicStaffs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching clinic staff",
      error: error.message,
    });
  }
};



const getTheme = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.clinicId).select("theme");
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });
    res.json(clinic.theme);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const editTheme = async (req, res) => {
  try {
    const { startColor, endColor, primaryForeground, sidebarForeground, secondary } = req.body;
    const clinic = await Clinic.findByIdAndUpdate(
      req.params.clinicId,
      { theme: { startColor, endColor, primaryForeground, sidebarForeground, secondary } },
      { new: true }
    );
    res.json({ message: "Theme updated successfully", theme: clinic.theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
const subscribeClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, package: pkg, price } = req.body;

    const clinic = await Clinic.findById(id);
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });

    const subscription = clinic.activateSubscription(type, pkg, price);
    await clinic.save();

    res.status(200).json({
      success: true,
      message: `Clinic subscribed to ${pkg} plan (${type}) successfully`,
      subscription,
    });
  } catch (error) {
    console.error("Error subscribing clinic:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getClinicDashboardDetails = async (req, res) => {
  try {
    const { id: clinicId } = req.params;

    // ✅ Validate clinic ID
    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    // ✅ Fetch clinic info (only DB call — can't parallelize easily)
    const clinic = await Clinic.findById(clinicId)
      .populate("staffs.nurses")
      .populate("staffs.receptionists")
      .populate("staffs.pharmacists")
      .populate("staffs.accountants")
      .populate("staffs.technicians")
      .lean();

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // ✅ Define async functions for each external API
    

    const fetchAppointments = async () => {
      try {
        const response = await axios.get(
          `${PATIENT_SERVICE_BASE_URL}/appointment/clinic-appointments/${clinicId}`
        );
        return response.data?.data || [];
      } catch (err) {
        console.error("❌ Error fetching appointments:", err.message);
        return [];
      }
    };

    const fetchActiveDoctors = async () => {
      try {
        const response = await axios.get(
          `${CLINIC_SERVICE_BASE_URL}/active-doctors?clinicId=${clinicId}`
        );
        return response.data?.doctors || [];
      } catch (err) {
        console.error("❌ Error fetching active doctors:", err.message);
        return [];
      }
    };

    const fetchPendingLabOrders = async () => {
      try {
        const response = await axios.get(
          `${LAB_SERVICE_BASE_URL}/api/v1/lab-orders/clinic-dental-orders/${clinicId}?status=pending`
        );
        return {
          count: response.data?.count || 0,
          orders: response.data?.pendingOrders || [],
        };
      } catch (err) {
        console.error("❌ Error fetching pending lab orders:", err.message);
        return { count: 0, orders: [] };
      }
    };
    const fetchTotalRevenue = async () => {
      try {
        const response = await axios.get(`${PATIENT_SERVICE_BASE_URL}/consultation/current-month-revenue/${clinicId}`);
        // console.log("this",response);
        return response.data?.totalRevenue || 0;
      } catch (error) {
        console.error("❌ Error fetching total revenue:", error);
        return 0;
      }
    }

    // ✅ Run all 4 external requests in parallel
    const [ todaysAppointments, activeDoctors, pendingLabOrders, totalRevenue] = await Promise.all([
      
      fetchAppointments(),
      fetchActiveDoctors(),
      fetchPendingLabOrders(),
      fetchTotalRevenue()
    ]);

    // ✅ Calculate total staff count
    const totalStaffCount =
      (clinic.staffs.nurses?.length || 0) +
      (clinic.staffs.receptionists?.length || 0) +
      (clinic.staffs.pharmacists?.length || 0) +
      (clinic.staffs.accountants?.length || 0) +
      (clinic.staffs.technicians?.length || 0) +
      (activeDoctors?.length || 0);

    // ✅ Respond with combined dashboard data
    return res.status(200).json({
      success: true,
      clinic: {
        id: clinic._id,
        name: clinic.name,
        staffs: clinic.staffs,
        subscription: clinic.subscription,
        totalStaffCount,
      },
     
      todaysAppointments,
      activeDoctors,
      // pendingLabOrders: pendingLabOrders.orders,
      pendingLabOrdersCount: pendingLabOrders.count,
      totalRevenue: totalRevenue,
    });
  } catch (error) {
    console.error("getClinicDashboardDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching clinic dashboard",
      error: error.message,
    });
  }
};
const addShiftToStaff = async (req, res) => {
  try {
    const { id } = req.params;
    let { startTime, endTime, startDate, endDate, role } = req.body;

    // ✅ Select model based on role
    let Model;
    switch (role) {
      case "nurse":
        Model = Nurse;
        break;
      case "pharmacist":
        Model = Pharmacist;
        break;
      case "receptionist":
        Model = Receptionist;
        break;
      case "accountant":
        Model = Accountant;
        break;
      case "technician":
        Model = Technician;
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // ✅ Parse DD-MM-YYYY to valid Date
    const parseDate = (str) => {
      if (!str) return null;
      const [day, month, year] = str.split("-");
      const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (isNaN(d)) throw new Error(`Invalid date: ${str}`);
      return d;
    };

    startDate = parseDate(startDate);
    endDate = parseDate(endDate);

    // ✅ Find staff
    const staff = await Model.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    // ✅ If there is at least one shift → update the latest one
    if (staff.shifts && staff.shifts.length > 0) {
      const latestShiftIndex = staff.shifts.length - 1;
      const latestShift = staff.shifts[latestShiftIndex];

      latestShift.startTime = startTime;
      latestShift.endTime = endTime;
      latestShift.startDate = startDate;
      latestShift.endDate = endDate;
      latestShift.isActive = true;
      latestShift.archivedAt = null;
      latestShift.updatedAt = new Date();
    } else {
      // ✅ If no shift exists → create new
      staff.shifts = [
        {
          startTime,
          endTime,
          startDate,
          endDate,
          isActive: true,
        },
      ];
    }

    await staff.save();

    res.status(200).json({
      success: true,
      message: staff.shifts.length === 1 ? "Shift added" : "Shift updated",
      shifts: staff.shifts,
    });
  } catch (error) {
    console.error("addShiftToStaff error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};


const removeStaffFromClinic = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const { staffId, role } = req.body;

    if (!staffId || !role) {
      return res.status(400).json({ success: false, message: "staffId and role are required" });
    }

    let Model;
    switch (role) {
      case "nurse": Model = Nurse; break;
      case "pharmacist": Model = Pharmacist; break;
      case "receptionist": Model = Receptionist; break;
      case "accountant": Model = Accountant; break;
      case "technician": Model = Technician; break;
      default: return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const staff = await Model.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });

    const staffArray = clinic.staffs[`${role}s`] || [];
    if (!staffArray.some(id => id.toString() === staffId)) {
      return res.status(400).json({ success: false, message: "Staff does not belong to this clinic" });
    }

    // Remove staff reference from clinic
    await Clinic.findByIdAndUpdate(clinicId, {
      $pull: { [`staffs.${role}s`]: staff._id }
    });

    // Delete staff from DB
    await Model.findByIdAndDelete(staffId);

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} removed and deleted successfully`
    });
  } catch (error) {
    console.error("removeStaffFromClinic error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getClinicStaffCounts = async (req, res) => {
  try {
    const { id: clinicId } = req.params;

    // Validate clinicId
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinic ID" });
    }

    const clinic = await Clinic.findById(clinicId)
      .select("staffs")
      .lean();

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // Base counts from clinic's staffs object
    const staffCounts = {
      nurses: clinic.staffs?.nurses?.length || 0,
      receptionists: clinic.staffs?.receptionists?.length || 0,
      pharmacists: clinic.staffs?.pharmacists?.length || 0,
      accountants: clinic.staffs?.accountants?.length || 0,
      technicians: clinic.staffs?.technicians?.length || 0,
    };



    const total =
      staffCounts.nurses +
      staffCounts.receptionists +
      staffCounts.pharmacists +
      staffCounts.accountants +
      staffCounts.technicians;

    return res.status(200).json({
      success: true,
      message: "Clinic staff counts fetched successfully",
      clinicId,
      staffCounts,
      total,
    });
  } catch (error) {
    console.error("❌ Error in getClinicStaffCounts:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching staff counts",
      error: error.message,
    });
  }
};
const registerSubClinic = async (req, res) => {
  try {
    const { id: parentClinicId } = req.params;
    const {
      name,
      type,
      email,
      phoneNumber,
      password,
      address,
      description,
      theme,
      features,
      isOwnLab = false,
      isSubClinic = true,
    } = req.body;

    // ===== Validate Parent Clinic =====
    if (!parentClinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Parent clinic ID is required" });
    }

    const parentClinic = await Clinic.findById(parentClinicId);
    if (!parentClinic) {
      return res
        .status(404)
        .json({ success: false, message: "Parent clinic not found" });
    }

    if (!parentClinic.isMultipleClinic) {
      return res.status(403).json({
        success: false,
        message:
          "This clinic is not authorized to have subclinics (isMultipleClinic is false)",
      });
    }

    // ===== Validate Input =====
    if (!name || !nameValidator(name)) {
      return res.status(400).json({ success: false, message: "Invalid name" });
    }
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    if (!phoneNumber || !phoneValidator(phoneNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }
    if (!password || !passwordValidator(password)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid password" });
    }

    // ===== Check for duplicate email/phone =====
    const [existingEmail, existingPhone] = await Promise.all([
      Clinic.findOne({ email }),
      Clinic.findOne({ phoneNumber }),
    ]);

    if (existingEmail)
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });

    if (existingPhone)
      return res
        .status(400)
        .json({ success: false, message: "Phone number already exists" });

    // ===== Create SubClinic =====
    const newSubClinic = new Clinic({
      name,
      type,
      email,
      phoneNumber,
      password,
      address,
      description,
      theme,
      isOwnLab,
      parentClinicId,
    });
    if (parentClinic.subscription) {
      // ✨ EDITED: align field names to subscription schema (package, type, price, startDate, endDate, isActive)
      newSubClinic.subscription = {
        package: parentClinic.subscription.package,
        type: parentClinic.subscription.type,
        price: parentClinic.subscription.price || 0,
        startDate:
          parentClinic.subscription.startDate ||
          parentClinic.subscription.startDate,
        endDate:
          parentClinic.subscription.endDate ||
          parentClinic.subscription.endDate,
        isActive: !!parentClinic.subscription.isActive,
        nextBillingDate:
          parentClinic.subscription.nextBillingDate ||
          parentClinic.subscription.endDate ||
          null,
        lastPaymentDate: parentClinic.subscription.lastPaymentDate || null,
        transactionId: parentClinic.subscription.transactionId || null,
      };
    }

    // ================================================================
    // ✅ Inherit All Features From Parent Clinic
    // ================================================================

    if (parentClinic.features) {
      newSubClinic.features = JSON.parse(JSON.stringify(parentClinic.features)); // Deep copy
    }
    // ===== Optional Feature Overrides =====
    // if (features && typeof features === "object") {
    //   Object.entries(features).forEach(([key, value]) => {
    //     if (key in newSubClinic.features) {
    //       if (typeof value === "object") {
    //         Object.entries(value).forEach(([subKey, subVal]) => {
    //           if (
    //             newSubClinic.features[key] &&
    //             subKey in newSubClinic.features[key]
    //           ) {
    //             newSubClinic.features[key][subKey] = !!subVal;
    //           }
    //         });
    //       } else {
    //         newSubClinic.features[key] = !!value;
    //       }
    //     }
    //   });
    // }

    // ===== Save SubClinic =====
    await newSubClinic.save();

    // ===== Link to Parent Clinic =====
    parentClinic.subClinics.push(newSubClinic._id);
    await parentClinic.save();

    // ===== Generate Tokens =====
    const accessToken = newSubClinic.generateAccessToken();
    const refreshToken = newSubClinic.generateRefreshToken();

    return res.status(201).json({
      success: true,
      message: "Subclinic registered successfully",
      subClinic: {
        id: newSubClinic._id,
        name: newSubClinic.name,
        email: newSubClinic.email,
        phoneNumber: newSubClinic.phoneNumber,
        parentClinicId: newSubClinic.parentClinicId,
        isOwnLab: newSubClinic.isOwnLab,
        subscription: newSubClinic.subscription,
        features: newSubClinic.features,
        theme: newSubClinic.theme,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in registerSubClinic:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during subclinic registration",
      details: error.message,
    });
  }
};
const assignClinicLab = async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    const { labId } = req.body;

    // ✅ Validate input
    if (!labId || typeof labId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing labId in request body.",
      });
    }

    // ✅ Find the clinic
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found.",
      });
    }

    // ✅ Check if clinic can have labs
    if (!clinic.isOwnLab) {
      return res.status(400).json({
        success: false,
        message: "This clinic is not allowed to have its own lab.",
      });
    }

    // ✅ Initialize labIds array if not exists
    if (!Array.isArray(clinic.labIds)) {
      clinic.labIds = [];
    }

    // ✅ Prevent duplicate lab entries
    if (!clinic.labIds.includes(labId)) {
      clinic.labIds.push(labId);
      await clinic.save();
    }

    return res.status(200).json({
      success: true,
      message: "Lab assigned successfully to clinic.",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        isOwnLab: clinic.isOwnLab,
        labIds: clinic.labIds,
      },
    });
  } catch (error) {
    console.error("❌ Error assigning lab to clinic:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while assigning lab.",
      details: error.message,
    });
  }
};

const clicnicCount = async (req, res) => {
  try {
    const now = new Date();

    // Total clinics
    const totalClinics = await Clinic.countDocuments();

    // Active clinics
    const activeClinics = await Clinic.countDocuments({
      "subscription.endDate": { $gte: now }
    });

    // Expired clinics
    const expiredClinics = await Clinic.countDocuments({
      "subscription.endDate": { $lt: now }
    });

    return res.status(200).json({
      success: true,
      message: "Clinic Count fetched successfully",
      data: {
        totalClinics,
        activeClinics,
        expiredClinics
      }
    });

  } catch (error) {
    console.log("Summary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

const allClinicsStatus = async (req, res) => {
  try {
    let { page, limit } = req.query;

    // Convert to number and set defaults
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;

    // Fetch clinics with pagination
    const clinics = await Clinic.find()
      .skip(skip)
      .limit(limit)
      .lean();


    function timeAgo(date) {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      if (seconds < 60) return "just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} minutes ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hours ago`;
      const days = Math.floor(hours / 24);
      return `${days} days ago`;
    }

    clinics.forEach(c => {
      const nurses = c.staffs?.nurses?.length || 0;
      const receptionists = c.staffs?.receptionists?.length || 0;
      const pharmacists = c.staffs?.pharmacists?.length || 0;
      const accountants = c.staffs?.accountants?.length || 0;
      const technicians = c.staffs?.technicians?.length || 0;

      c.staffsCount = {
        nurses,
        receptionists,
        pharmacists,
        accountants,
        technicians,
        total: nurses + receptionists + pharmacists + accountants + technicians
      };

      c.lastActiveAgo = c.lastActive ? timeAgo(c.lastActive) : "N/A";
    });

    // Get total count for frontend pagination
    const total = await Clinic.countDocuments();

    res.status(200).json({
      message: "Clinics Fetched Successfully",
      data: clinics,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const getSubscriptionStats = async (req, res) => {
  try {
    const stats = await Clinic.aggregate([
      {
        $group: {
          _id: "$subscription.package",  // starter, growth, enterprise
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          plan: "$_id",
          count: 1
        }
      }
    ]);

    return res.status(200).json({
      message: "Subscription stats fetched successfully",
      data: stats
    });

  } catch (error) {
    console.error("Subscription Stats Error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

const toggleClinicAccess = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });


    clinic.isActive = !clinic.isActive;
    await clinic.save();

    res.json({
      message: `Clinic is now ${clinic.isActive ? "ENABLED" : "DISABLED"}`,
      isActive: clinic.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const upgradeSubscription = async (req, res) => {
  try {
    const clinicId = req.clinicId; // ✅ FIX
    const { package: newPackage, transactionId } = req.body;

    if (!["starter", "growth", "enterprise"].includes(newPackage)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    const currentPackage = clinic.subscription?.package || "starter";

    const order = ["starter", "growth", "enterprise"];
    if (order.indexOf(newPackage) <= order.indexOf(currentPackage)) {
      return res.status(400).json({
        message: "Downgrade or same plan not allowed",
      });
    }

    const now = new Date();
    const endDate = new Date();
    endDate.setFullYear(now.getFullYear() + 1);

    clinic.subscription = {
      package: newPackage,
      type: "annual",
      price: PLAN_PRICES[newPackage],
      startDate: now,
      endDate,
      isActive: true,
      nextBillingDate: endDate,
      lastPaymentDate: now,
      transactionId,
    };

    clinic.applySubscriptionFeatures(newPackage);
    await clinic.save();

    return res.status(200).json({
      success: true,
      message: `Upgraded to ${newPackage} plan successfully`,
      subscription: clinic.subscription,
    });
  } catch (error) {
    console.error("🔴 UPGRADE ERROR:", error);
    return res.status(500).json({
      message: "Subscription upgrade failed",
    });
  }
};
const updateSubClinic = async (req, res) => {
  try {
    const { subClinicId } = req.params;
    const parentClinicId = req.clinicId;

    // 1️⃣ Find sub-clinic
    const subClinic = await Clinic.findById(subClinicId);

    if (!subClinic) {
      return res.status(404).json({ message: "Sub-clinic not found" });
    }

    // 2️⃣ Ownership check (SAFE)
    if (
      subClinic.parentClinicId &&
      subClinic.parentClinicId.toString() !== parentClinicId.toString()
    ) {
      return res.status(403).json({
        message: "You do not own this sub-clinic",
      });
    }

    // 3️⃣ Build update payload
    const updatePayload = {};
    const { name, phoneNumber, address, bank } = req.body;

    if (name) updatePayload.name = name;
    if (phoneNumber) updatePayload.phoneNumber = phoneNumber;
    if (address) updatePayload.address = address;
    if (bank) updatePayload.bank = bank;

    // 🔍 DEBUG (keep for now)
    console.log("UPDATE PAYLOAD:", updatePayload);

    // 4️⃣ Update
    const updatedClinic = await Clinic.findByIdAndUpdate(
      subClinicId,
      { $set: updatePayload },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Sub-clinic updated successfully",
      data: updatedClinic,
    });
  } catch (err) {
    console.error("UPDATE SUB-CLINIC ERROR:", err);
    return res.status(500).json({ message: "Update failed" });
  }
};
const uploadClinicLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    // OPTIONAL: delete old logo file later (advanced)
    clinic.logo = `/uploads/logos/${req.file.filename}`;
    await clinic.save();

    res.json({
      success: true,
      logo: clinic.logo,
    });
  } catch (error) {
    console.error("uploadClinicLogo error:", error);
    res.status(500).json({ message: "Logo upload failed" });
  }
};
const deleteLogo = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    clinic.logo = "";
    await clinic.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Delete logo error:", err);
    res.status(500).json({ message: "Failed to delete logo" });
  }
};
const getSubClinics = async (req, res) => {
  try {
    const parentClinicId = req.clinicId;

    const subClinics = await Clinic.find({
      parentClinicId: parentClinicId,
    }).select("-password");

    return res.status(200).json({
      success: true,
      data: subClinics, // ✅ ARRAY
    });
  } catch (error) {
    console.error("GET SUB CLINICS ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch sub clinics",
    });
  }
};
const loginSubClinic = async (req, res) => {
  const { email, password } = req.body;

  try {
    // ====== VALIDATIONS ======
    if (!email || !emailValidator(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // ====== FIND CLINIC ======
    const clinic = await Clinic.findOne({ email });
    if (!clinic) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // CHECK ACTIVE STATUS
    if (!clinic.isActive) {
      return res.status(403).json({
        message: "Your clinic access has been disabled by SuperAdmin.",
      });
    }

    // ====== VERIFY PASSWORD ======
    const isMatch = await clinic.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ====== GENERATE TOKENS ======
    const accessToken = clinic.generateAccessToken();
    const refreshToken = clinic.generateRefreshToken();
    let subClinics = [];
    if (clinic.isMultipleClinic) {
      subClinics = await Clinic.find({ parentClinicId: clinic._id })
        .select(
          "_id name email phoneNumber type isOwnLab subscription isActive"
        )
        .lean();
    }

    res.status(200).json({
      message: "Login successful",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        phoneNumber: clinic.phoneNumber,
        type: clinic.type,
        role: clinic.role,
        subscription: clinic.subscription,
        subClinics,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ Error in loginClinic:", error);
    res.status(500).json({ message: "Server error" });
  }
};
export {
  registerClinic, loginClinic, viewAllClinics, viewClinicById, editClinic, getClinicStaffs, getTheme, editTheme, subscribeClinic, getClinicDashboardDetails, addShiftToStaff, removeStaffFromClinic, getClinicStaffCounts, registerSubClinic, assignClinicLab, clicnicCount, allClinicsStatus,
  getSubscriptionStats, toggleClinicAccess,upgradeSubscription,updateSubClinic,uploadClinicLogo,deleteLogo,getSubClinics,loginSubClinic
}
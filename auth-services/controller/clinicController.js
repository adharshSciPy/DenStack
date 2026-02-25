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
import Doctor from "../models/doctorSchema.js";
import { geocodeAddress } from "../utils/geocodingService.js";
import Salary from "../models/salarySchema.js";
config();
const CLINIC_SERVICE_BASE_URL = process.env.CLINIC_SERVICE_BASE_URL || "http://localhost:8003/api/v1/clinic-service";
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL || "http://localhost:8002/api/v1/patient-service";
const LAB_SERVICE_BASE_URL = process.env.LAB_SERVICE_BASE_URL || "http://localhost:8006";
const formatDate = (dateStr) => {
  const [day, month, year] = dateStr.split("-");
  return new Date(`${year}-${month}-${day}`);
};
const formatMonth = (month, year) => {
  if (!month || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
};
const registerClinic = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

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
      isClinicAdminDoctor = false,
      doctorDetails
    } = req.body;

    // Validation
    if (!name || !nameValidator(name)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid name" });
    }
    if (!email || !emailValidator(email)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    if (!phoneNumber || !phoneValidator(phoneNumber)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid phone number" });
    }
    if (!password || !passwordValidator(password)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    // Check existing clinic
    const existingClinicByEmail = await Clinic.findOne({ email }).session(session);
    const existingClinicByPhone = await Clinic.findOne({ phoneNumber }).session(session);

    if (existingClinicByEmail) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Email already exists" });
    }
    
    if (existingClinicByPhone) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Phone number already exists" });
    }

    // Check if doctor with same email or phone exists
    let existingDoctor = null;
    if (isClinicAdminDoctor) {
      existingDoctor = await Doctor.findOne({
        $or: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      }).session(session);
    }

    // Create new clinic
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
      googlePlaceId,
      isClinicAdminDoctor
    });

    // Set default subscription
    newClinic.activateSubscription("annual", "starter", 0);
    newClinic.applySubscriptionFeatures();

    // Override features if provided
    if (features && typeof features === "object") {
      Object.entries(features).forEach(([key, value]) => {
        if (key in newClinic.features) {
          if (typeof value === "object") {
            Object.entries(value).forEach(([subKey, subVal]) => {
              if (newClinic.features[key] && subKey in newClinic.features[key]) {
                newClinic.features[key][subKey] = !!subVal;
              }
            });
          } else {
            newClinic.features[key] = !!value;
          }
        }
      });
    }

    // Save clinic first
    await newClinic.save({ session });

    let doctorData = null;
    let onboardingResult = null;
    let doctorUniqueId = null;

    // Handle hybrid doctor-clinic admin
    if (isClinicAdminDoctor && doctorDetails) {
      try {
        if (!existingDoctor) {
          // Create new doctor
          const newDoctor = new Doctor({
            name: name,
            email: email,
            phoneNumber: phoneNumber,
            password: password,
            specialization: Array.isArray(doctorDetails.specialization) 
              ? doctorDetails.specialization[0] 
              : doctorDetails.specialization || "General Dentistry",
            licenseNumber: doctorDetails.licenseNumber || `TEMP-${Date.now()}`,
            isClinicDoctor: true,
            isClinicAdmin: true,
            status: "Active",
            approve: true
          });

          await newDoctor.save({ session });
          doctorData = newDoctor;
          doctorUniqueId = newDoctor.uniqueId;
          
          console.log("✅ Created new doctor:", {
            id: doctorData._id,
            uniqueId: doctorData.uniqueId,
            name: doctorData.name
          });
        } else {
          // Update existing doctor
          existingDoctor.isClinicAdmin = true;
          existingDoctor.isClinicDoctor = true;
          
          if (!existingDoctor.clinicOnboardingDetails) {
            existingDoctor.clinicOnboardingDetails = [];
          }
          
          await existingDoctor.save({ session });
          doctorData = existingDoctor;
          doctorUniqueId = existingDoctor.uniqueId;
          
          console.log("✅ Updated existing doctor:", {
            id: doctorData._id,
            uniqueId: doctorData.uniqueId,
            name: doctorData.name
          });
        }

        // Now onboard to clinic service with hybrid flag
        if (doctorUniqueId) {
          // Make sure doctorData has _id before sending
          if (!doctorData._id) {
            console.error("❌ doctorData missing _id before sending to clinic service");
            throw new Error("Doctor ID is missing");
          }
          
          console.log("📤 Sending to clinic service:", {
            clinicId: newClinic._id.toString(),
            doctorUniqueId: doctorUniqueId,
            doctorId: doctorData._id.toString()
          });
          
          const onboardResponse = await axios.post(
                `${process.env.CLINIC_SERVICE_BASE_URL}/onboard-doctor`,
                {
                  clinicId: newClinic._id.toString(),
                  doctorUniqueId: doctorUniqueId,
                  // Use 'consultant' or whatever role is allowed in your enum
                  // If you want admin role, make sure it's in the enum
                  roleInClinic: "consultant", // Changed from "admin" to "consultant"
                  standardConsultationFee: doctorDetails.consultationFee || 0,
                  specialization: Array.isArray(doctorDetails.specialization) 
                    ? doctorDetails.specialization 
                    : [doctorDetails.specialization || "General Dentistry"],
                  createdBy: newClinic._id.toString(),
                  isHybridOnboarding: true,
                  doctorData: {
                    _id: doctorData._id.toString(),
                    name: doctorData.name,
                    email: doctorData.email,
                    uniqueId: doctorData.uniqueId,
                    isClinicAdmin: doctorData.isClinicAdmin
                  }
                },
                {
                  timeout: 10000,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );

          console.log("✅ Onboard response status:", onboardResponse.status);
          console.log("✅ Onboard response data:", onboardResponse.data);
          
          if (onboardResponse.data?.success) {
            onboardingResult = onboardResponse.data.data;
            
            // Add availability if provided
            if (doctorDetails.availability && doctorDetails.availability.length > 0) {
              try {
                const availResponse = await axios.post(
                  `${process.env.CLINIC_SERVICE_BASE_URL}/availability-doctor/${doctorUniqueId}`,
                  {
                    clinicId: newClinic._id.toString(),
                    availability: doctorDetails.availability,
                    createdBy: newClinic._id.toString()
                  }
                );
                console.log("✅ Availability response:", availResponse.data);
              } catch (availError) {
                console.error("⚠️ Error adding doctor availability:", availError.response?.data || availError.message);
              }
            }
          }
        }
      } catch (doctorError) {
        console.error("❌ Detailed doctor error:", {
          message: doctorError.message,
          response: doctorError.response?.data,
          status: doctorError.response?.status,
          stack: doctorError.stack
        });
        
        await session.abortTransaction();
        session.endSession();
        
        return res.status(500).json({
          success: false,
          message: "Failed to create/onboard doctor",
          details: doctorError.response?.data?.message || doctorError.message
        });
      }
    }

    // Generate tokens
    let accessToken, refreshToken;
    if (isClinicAdminDoctor && doctorUniqueId) {
      const hybridRole = process.env.HYBRID_ROLE || "760";
      
      accessToken = jwt.sign(
        {
          _id: newClinic._id,
          clinicId: newClinic._id,
          doctorUniqueId: doctorUniqueId,
          name: newClinic.name,
          email: newClinic.email,
          role: hybridRole,
          isHybrid: true
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
      );

      refreshToken = jwt.sign(
        {
          clinicId: newClinic._id,
          doctorUniqueId: doctorUniqueId,
          role: hybridRole,
          isHybrid: true
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
      );
    } else {
      accessToken = newClinic.generateAccessToken();
      refreshToken = newClinic.generateRefreshToken();
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: isClinicAdminDoctor 
        ? "Clinic registered successfully with doctor onboarded" 
        : "Clinic registered successfully",
      clinic: {
        id: newClinic._id,
        name: newClinic.name,
        email: newClinic.email,
        phoneNumber: newClinic.phoneNumber,
        type: newClinic.type,
        role: isClinicAdminDoctor ? (process.env.HYBRID_ROLE || "760") : newClinic.role,
        subscription: newClinic.subscription,
        features: newClinic.features,
        theme: newClinic.theme,
        isMultipleClinic: newClinic.isMultipleClinic,
        isOwnLab: newClinic.isOwnLab,
        googlePlaceId: newClinic.googlePlaceId,
        isClinicAdminDoctor: newClinic.isClinicAdminDoctor,
          address: newClinic.address ? {
      street: newClinic.address.street,
      city: newClinic.address.city,
      state: newClinic.address.state,
      country: newClinic.address.country,
      zip: newClinic.address.zip,
      formattedAddress: newClinic.address.formattedAddress,
      // ✅ ADD LOCATION COORDINATES
      location: newClinic.address.location ? {
        type: newClinic.address.location.type,
        coordinates: newClinic.address.location.coordinates
      } : null
    } : null
      },
      doctor: doctorData ? {
        id: doctorData._id,
        name: doctorData.name,
        email: doctorData.email,
        uniqueId: doctorData.uniqueId,
        specialization: doctorData.specialization,
        isClinicAdmin: doctorData.isClinicAdmin,
        licenseNumber: doctorData.licenseNumber
      } : null,
      doctorOnboarding: onboardingResult,
      accessToken,
      refreshToken
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
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

    // ====== CHECK IF HYBRID USER ======
    let doctor = null;
    let hybridRole = null;
    
    // Check if this clinic has a doctor with isClinicAdmin = true
    // This is the key change - find doctor by clinic email/phone instead of linkedDoctorId
    if (clinic.isClinicAdminDoctor) {
      // Find doctor with matching email OR phone number (since they share credentials)
      doctor = await Doctor.findOne({
        $or: [
          { email: clinic.email },
          { phoneNumber: clinic.phoneNumber }
        ],
        isClinicAdmin: true
      }).select('-password');
      
      if (doctor) {
        hybridRole = process.env.HYBRID_ROLE || "760";
        console.log(`✅ Hybrid user detected: Clinic ${clinic._id} with Doctor ${doctor._id}`);
        
        // Optionally update the clinic with linkedDoctorId for future reference
        if (!clinic.linkedDoctorId) {
          clinic.linkedDoctorId = doctor._id;
          await clinic.save();
        }
      } else {
        // Also check DoctorClinic mapping as a fallback
        const doctorClinicMapping = await DoctorClinic.findOne({
          clinicId: clinic._id,
          roleInClinic: "admin" // or "consultant" depending on your schema
        }).populate('doctorId');
        
        if (doctorClinicMapping?.doctorId) {
          doctor = doctorClinicMapping.doctorId;
          hybridRole = process.env.HYBRID_ROLE || "760";
          console.log(`✅ Hybrid user detected via DoctorClinic: Clinic ${clinic._id} with Doctor ${doctor._id}`);
        }
      }
    }

    // ====== GENERATE TOKENS BASED ON USER TYPE ======
    let accessToken, refreshToken;

    if (hybridRole && doctor) {
      // 🔥 HYBRID USER - Generate token with both IDs
      accessToken = jwt.sign(
        {
          _id: clinic._id,
          clinicId: clinic._id,
          doctorId: doctor._id,
          doctorUniqueId: doctor.uniqueId,
          name: clinic.name,
          email: clinic.email,
          role: hybridRole,  // 760
          isHybrid: true,
          subscription: clinic.subscription.package
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
      );

      refreshToken = jwt.sign(
        {
          clinicId: clinic._id,
          doctorId: doctor._id,
          doctorUniqueId: doctor.uniqueId,
          role: hybridRole,
          isHybrid: true
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
      );
    } else {
      // 🔥 REGULAR CLINIC USER
      accessToken = clinic.generateAccessToken();
      refreshToken = clinic.generateRefreshToken();
    }

    // ====== GET SUB CLINICS IF MULTIPLE ======
    let subClinics = [];
    if (clinic.isMultipleClinic) {
      subClinics = await Clinic.find({ parentClinicId: clinic._id })
        .select("_id name email phoneNumber type isOwnLab subscription isActive")
        .lean();
    }

    // ====== PREPARE RESPONSE ======
    const response = {
      message: hybridRole ? "Hybrid login successful" : "Login successful",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        phoneNumber: clinic.phoneNumber,
        type: clinic.type,
        role: hybridRole || clinic.role,  // This will now be 760 for hybrid users
        isHybrid: !!hybridRole,
        subscription: clinic.subscription,
        subClinics,
        isClinicAdminDoctor: clinic.isClinicAdminDoctor,
        linkedDoctorId: clinic.linkedDoctorId || (doctor ? doctor._id : null)
      },
      accessToken,
      refreshToken,
    };

    // 🔥 Add doctor info if hybrid
    if (hybridRole && doctor) {
      response.doctor = {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        uniqueId: doctor.uniqueId,
        isClinicAdmin: doctor.isClinicAdmin,
        role: hybridRole
      };
      
      response.message = "Clinic login successful (with doctor privileges)";
    }

    res.status(200).json(response);

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
const getLocationBasedClinics = async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInMeters = radius * 1000;

    const clinics = await Clinic.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          distanceField: "distance", // this field will be added
          maxDistance: radiusInMeters,
          spherical: true,
          distanceMultiplier: 0.001, // convert meters → KM
        },
      },
      {
        $match: {
          isActive: true,
          $or: [
            { isApproved: true },
            { isApproved: false }, // for testing
          ],
        },
      },
      {
        $project: {
          name: 1,
          address: 1,
          phoneNumber: 1,
          email: 1,
          ratingAvg: 1,
          totalReviews: 1,
          description: 1,
          distance: { $round: ["$distance", 2] }, // round to 2 decimals
        },
      },
    ]);

    res.json({
      success: true,
      count: clinics.length,
      radius: radius,
      data: clinics,
    });
  } catch (error) {
    console.error("Error finding nearby clinics:", error);
    res.status(500).json({
      success: false,
      message: "Error finding nearby clinics",
      error: error.message,
    });
  }
};



export const getClinicStaffSalaries = async (req, res) => {
  try {
    const { clinicId } = req.params;
    let { month, year } = req.query;

    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: "Invalid clinicId" });
    }

    // 📅 Month filter
    let monthKey = null;
    if (month && year) {
      monthKey = formatMonth(month, year);
    } else if (month && month.includes("-")) {
      monthKey = month; // already "2026-01"
    }

    if (!monthKey) {
      return res.status(400).json({
        success: false,
        message: "Month & year required",
      });
    }

    // 🔹 Fetch salaries
    const salaries = await Salary.find({
      clinicId,
      month: monthKey,
    }).lean();

    if (!salaries.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No salary records found",
      });
    }

    // 🔹 Group staffIds by role
    const roleStaffMap = {
      nurse: [],
      receptionist: [],
      pharmacist: [],
      accountant: [],
      technician: [],
      doctor: [],
    };

    salaries.forEach((sal) => {
      roleStaffMap[sal.role]?.push(sal.staffId);
    });

    // 🔹 Fetch staff details by role
    const staffData = {};

    if (roleStaffMap.nurse.length) {
      staffData.nurse = await Nurse.find({
        _id: { $in: roleStaffMap.nurse },
      }).lean();
    }

    if (roleStaffMap.receptionist.length) {
      staffData.receptionist = await Receptionist.find({
        _id: { $in: roleStaffMap.receptionist },
      }).lean();
    }

    if (roleStaffMap.pharmacist.length) {
      staffData.pharmacist = await Pharmacist.find({
        _id: { $in: roleStaffMap.pharmacist },
      }).lean();
    }

    if (roleStaffMap.accountant.length) {
      staffData.accountant = await Accountant.find({
        _id: { $in: roleStaffMap.accountant },
      }).lean();
    }

    if (roleStaffMap.technician.length) {
      staffData.technician = await Technician.find({
        _id: { $in: roleStaffMap.technician },
      }).lean();
    }

    if (roleStaffMap.doctor.length) {
      staffData.doctor = await Doctor.find({
        _id: { $in: roleStaffMap.doctor },
      }).lean();
    }

    // 🔹 Merge salary + staff info
    const result = salaries.map((sal) => {
      const staff = staffData[sal.role]?.find(
        (s) => s._id.toString() === sal.staffId.toString()
      );

      return {
        salaryId: sal._id,
        role: sal.role,
        month: sal.month,
        salaryAmount: sal.salaryAmount,
        note: sal.note,
        staff: staff
          ? {
              id: staff._id,
              name: staff.name,
              phoneNumber: staff.phoneNumber,
              email: staff.email,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      month: monthKey,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("❌ getClinicStaffSalaries error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
export {
  registerClinic, loginClinic, viewAllClinics, viewClinicById, editClinic, getClinicStaffs, getTheme, editTheme, subscribeClinic, getClinicDashboardDetails, addShiftToStaff, removeStaffFromClinic, getClinicStaffCounts, registerSubClinic, assignClinicLab, clicnicCount, allClinicsStatus,
  getSubscriptionStats, toggleClinicAccess,upgradeSubscription,updateSubClinic,uploadClinicLogo,deleteLogo,getSubClinics,loginSubClinic,getLocationBasedClinics
}
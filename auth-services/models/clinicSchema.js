import mongoose, { Schema } from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();

const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";

const clinicSchema = new Schema(
  {
    // ===== Basic Details =====
    name: {
      type: String,
      required: [true, "Clinic name is required"],
      trim: true,
      minlength: [2, "Clinic name must be at least 2 characters"],
      maxlength: [100, "Clinic name must not exceed 100 characters"],
    },

    type: {
      type: String,
      enum: ["single", "clinic", "hospital"],
      default: "clinic",
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      unique: true,
      match: [/\S+@\S+\.\S+/, "Please provide a valid email address"],
    },

    phoneNumber: {
      type: Number,
      required: [true, "Phone number is required"],
      unique: true,
      match: [
        /^[6-9]\d{9}$/,
        "Phone number must be 10 digits starting with 6-9",
      ],
    },

    googlePlaceId: { type: String, default: null }, // ⭐ IMPORTANT
    ratingAvg: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [64, "Password cannot exceed 64 characters"],
    },

    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      zip: { type: String },
    },

    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // ===== Theme Configuration =====
    theme: {
      startColor: { type: String, default: "#1E4D2B" },
      endColor: { type: String, default: "#3FA796" },
      primaryForeground: { type: String, default: "#ffffff" },
      sidebarForeground: { type: String, default: "#ffffff" },
      secondary: { type: String, default: "#3FA796" },
    },

    // ===== Role and Access =====
    role: {
      type: String,
      default: CLINIC_ROLE,
    },

    // ===== Subscription Plan =====
    subscription: {
      package: {
        type: String,
        enum: ["starter", "growth", "enterprise"],
        default: "starter",
      },
      type: { type: String, enum: ["annual"], default: "annual" },
      price: { type: Number, default: 0 },
      startDate: { type: Date, default: Date.now },
      endDate: Date,
      isActive: { type: Boolean, default: true },
      nextBillingDate: Date,
      lastPaymentDate: Date,
      transactionId: String,
    },

    // ===== Status =====
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: null,
    },
    isMultipleClinic: {
      type: Boolean,
      default: false,
    },
    isOwnLab: {
      type: Boolean,
      default: false,
    },
    labIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Lab",
      },
    ],
    // ===== Staff References =====
    staffs: {
      nurses: [{ type: Schema.Types.ObjectId, ref: "Nurse" }],
      receptionists: [{ type: Schema.Types.ObjectId, ref: "Reception" }],
      pharmacists: [{ type: Schema.Types.ObjectId, ref: "Pharmacist" }],
      accountants: [{ type: Schema.Types.ObjectId, ref: "Accountant" }],
      technicians: [{ type: Schema.Types.ObjectId, ref: "Technician" }],
    },

    // ===== Feature Controls (Super Admin Controlled) =====
    features: {
      canAddStaff: {
        nurses: { type: Boolean, default: false },
        receptionists: { type: Boolean, default: false },
        pharmacists: { type: Boolean, default: false },
        accountants: { type: Boolean, default: false },
        technicians: { type: Boolean, default: false },
      },
      canAddDoctors: { type: Boolean, default: true },
      canAddDepartments: { type: Boolean, default: true },
      canManageAppointments: { type: Boolean, default: true },
      canAccessBilling: { type: Boolean, default: true },
      canAccessReports: { type: Boolean, default: false },
    },
    // ===== Clinic Hierarchy =====
    parentClinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      default: null, // null for main clinics
    },

    subClinics: [
      {
        type: Schema.Types.ObjectId,
        ref: "Clinic",
      },
    ],
     // ===== NEW: Hybrid Doctor Fields =====
    isClinicAdminDoctor: {
      type: Boolean,
      default: false,  // Flag: Is this clinic admin also a doctor?
    },
    
    // Link to doctor record if hybrid
    linkedDoctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },

    // Doctor-specific details for hybrid admins
    doctorDetails: {
      specialization: { type: String, default: '' },
      licenseNumber: { type: String, default: '' },
      consultationFee: { type: Number, default: 0 },
      availability: [{
        dayOfWeek: String,
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    },
  },
  { timestamps: true },
);

// ===== Pre-save Hook: Hash Password =====
clinicSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// ===== Instance Methods =====

// 🔹 Password validation
clinicSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// 🔹 Address formatting
clinicSchema.methods.getFullAddress = function () {
  const { street, city, state, country, zip } = this.address || {};
  return [street, city, state, country, zip].filter(Boolean).join(", ");
};

// 🔹 Toggle active/inactive state
clinicSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.isActive;
};

// 🔹 JWT Access Token
clinicSchema.methods.generateAccessToken = function (role = CLINIC_ROLE) {
  return jwt.sign(
    {
      clinicId:     this._id,
      name:         this.name,
      email:        this.email,
      role,
      subscription: this.subscription.package,
      hospitalId:   this._id,   // ← add this
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

clinicSchema.methods.generateRefreshToken = function (role = CLINIC_ROLE) {
  return jwt.sign(
    {
      clinicId:     this._id,
      name:         this.name,
      email:        this.email,
      role,
      subscription: this.subscription.package,
      hospitalId:   this._id,   // ← add this
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

// 🔹 Activate subscription with dynamic duration
clinicSchema.methods.activateSubscription = function (
  type = "annual",
  pkg = "starter",
  price = 0,
) {
  const now = new Date();
  const endDate = new Date(now);

  // ONLY annual allowed
  endDate.setFullYear(now.getFullYear() + 1);

  this.subscription = {
    package: pkg,
    type,
    price,
    startDate: now,
    endDate,
    isActive: true,
    nextBillingDate: endDate,
  };

  return this.subscription;
};

// 🔹 Check subscription validity
clinicSchema.methods.isSubscriptionValid = function () {
  return (
    this.subscription?.isActive &&
    new Date() < new Date(this.subscription.endDate)
  );
};

// 🔹 Cancel subscription immediately
clinicSchema.methods.cancelSubscription = function () {
  this.subscription.isActive = false;
  this.subscription.endDate = new Date();
  return this.subscription;
};

// 🔹 Auto-apply features based on package
clinicSchema.methods.applySubscriptionFeatures = function () {
  if (this.subscription.package === "starter") {
    this.features.canAddStaff = {
      nurses: false,
      receptionists: true,
      pharmacists: false,
      accountants: false,
      technicians: false,
    };
    this.features.canAccessReports = false;
  }

  if (this.subscription.package === "growth") {
    this.features.canAddStaff = {
      nurses: true,
      receptionists: true,
      pharmacists: false,
      accountants: false,
      technicians: true,
    };
    this.features.canAccessReports = true;
  }

  if (this.subscription.package === "enterprise") {
    this.features.canAddStaff = {
      nurses: true,
      receptionists: true,
      pharmacists: true,
      accountants: true,
      technicians: true,
    };
    this.features.canAccessReports = true;
  }

  return this.features;
};

// ===== Export Model =====
const Clinic = mongoose.model("Clinic", clinicSchema);
export default Clinic;

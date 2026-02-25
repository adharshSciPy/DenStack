import mongoose, { Schema } from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import axios from "axios";
// import { geocodeAddress } from "../utils/geocodingService";

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
    // Add coordinates field
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      }
    },
    formattedAddress: { type: String } // Full address string
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
// Add these methods to your clinicSchema before exporting

// ===== Geocoding Methods =====

/**
 * Geocode the clinic's address and update location coordinates
 */
// In your clinicSchema.methods.geocodeAddress function
clinicSchema.methods.geocodeAddress = async function() {
  if (!this.address || !this.address.street || !this.address.city) {
    console.log('Incomplete address, skipping geocoding');
    return null;
  }

  try {
    // Try different address formats
    const addressVariations = [
      // Full address with all details
      `${this.address.street}, ${this.address.city}, ${this.address.state}, ${this.address.country} ${this.address.zip}`,
      // Without zip
      `${this.address.street}, ${this.address.city}, ${this.address.state}, ${this.address.country}`,
      // City and state only
      `${this.address.city}, ${this.address.state}, ${this.address.country}`,
      // Just the street and city
      `${this.address.street}, ${this.address.city}`
    ];
    
    let response = null;
    let successfulAddress = '';
    
    for (const addr of addressVariations) {
      console.log(`Trying address format: ${addr}`);
      
      response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: addr,
          format: 'json',
          limit: 1,
          countrycodes: 'in'
        },
        headers: {
          'User-Agent': 'DenStack/1.0'
        },
        timeout: 5000
      });

      if (response.data && response.data.length > 0) {
        successfulAddress = addr;
        break;
      }
      
      // Add small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (response && response.data && response.data.length > 0) {
      const { lat, lon, display_name } = response.data[0];
      
      this.address.location = {
        type: 'Point',
        coordinates: [parseFloat(lon), parseFloat(lat)]
      };
      
      this.address.formattedAddress = display_name || successfulAddress;
      
      console.log(`✅ Geocoded address for clinic: ${this.name}`, {
        coordinates: this.address.location.coordinates,
        formatted: this.address.formattedAddress
      });
      
      return this.address.location;
    } else {
      console.log(`❌ No geocoding results for any address variation`);
      // Don't save invalid location data
      this.address.location = undefined;
      return null;
    }
  } catch (error) {
    console.error(`Geocoding error for clinic ${this.name}:`, error.message);
    this.address.location = undefined; // Remove invalid location
    return null;
  }
};

/**
 * Update location coordinates if address has changed
 */
clinicSchema.methods.updateLocationIfNeeded = async function() {
  // Check if address fields have changed
  const addressChanged = this.isModified('address.street') || 
                         this.isModified('address.city') || 
                         this.isModified('address.state') || 
                         this.isModified('address.country') || 
                         this.isModified('address.zip');
  
  if (addressChanged && this.address) {
    console.log(`Address changed for clinic ${this.name}, updating coordinates...`);
    return await this.geocodeAddress();
  }
  
  return this.address?.location || null;
};

/**
 * Batch geocode all clinics without coordinates
 */
clinicSchema.statics.batchGeocodeMissingLocations = async function(limit = 10) {
  const clinics = await this.find({
    $or: [
      { 'address.location': null },
      { 'address.location.coordinates': { $size: 0 } }
    ],
    'address.street': { $exists: true, $ne: '' },
    'address.city': { $exists: true, $ne: '' }
  }).limit(limit);

  console.log(`Found ${clinics.length} clinics needing geocoding`);

  const results = {
    total: clinics.length,
    succeeded: 0,
    failed: 0,
    details: []
  };

  for (const clinic of clinics) {
    try {
      const location = await clinic.geocodeAddress();
      if (location) {
        await clinic.save();
        results.succeeded++;
        results.details.push({
          clinicId: clinic._id,
          name: clinic.name,
          success: true,
          coordinates: location.coordinates
        });
      } else {
        results.failed++;
        results.details.push({
          clinicId: clinic._id,
          name: clinic.name,
          success: false,
          reason: 'No geocoding results'
        });
      }
      
      // Add delay to respect Nominatim usage policy
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.failed++;
      results.details.push({
        clinicId: clinic._id,
        name: clinic.name,
        success: false,
        reason: error.message
      });
    }
  }

  return results;
};
// Add these middleware functions before exporting the model

// ===== Middleware =====

// Pre-save middleware to geocode address
// Pre-save middleware to geocode address
clinicSchema.pre('save', async function(next) {
  try {
    const addressChanged = this.isModified('address.street') || 
                           this.isModified('address.city') || 
                           this.isModified('address.state') || 
                           this.isModified('address.country') || 
                           this.isModified('address.zip');
    
    const locationMissing = this.address && 
                           (!this.address.location || 
                            !this.address.location.coordinates || 
                            this.address.location.coordinates.length !== 2);
    
    if ((addressChanged || locationMissing) && 
        this.address && 
        this.address.street && 
        this.address.city) {
      
      console.log(`Auto-geocoding address for clinic: ${this.name}`);
      const location = await this.geocodeAddress();
      
      // If geocoding failed, remove the location field entirely
      // to avoid MongoDB index error
      if (!location) {
        console.log(`⚠️ Geocoding failed for ${this.name}, removing location data`);
        this.address.location = undefined;
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in pre-save geocoding:', error);
    // Ensure location is removed on error
    if (this.address) {
      this.address.location = undefined;
    }
    next();
  }
});

// Post-save middleware to log geocoding status
clinicSchema.post('save', function(doc) {
  if (doc.address && doc.address.location && doc.address.location.coordinates) {
    console.log(`✅ Clinic ${doc.name} has location coordinates:`, doc.address.location.coordinates);
  } else if (doc.address && doc.address.street && doc.address.city) {
    console.log(`⚠️ Clinic ${doc.name} has address but no coordinates - geocoding may have failed`);
  }
});

// Pre-findOneAndUpdate middleware for updates
clinicSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate();
    
    // Check if address is being updated
    if (update.address || update['address.street'] || update['address.city']) {
      // We need to geocode the new address
      // Since we don't have the document, we'll need to fetch it
      const docToUpdate = await this.model.findOne(this.getQuery());
      
      if (docToUpdate) {
        // Merge existing address with updates
        const updatedAddress = {
          ...docToUpdate.address?.toObject(),
          ...(update.address || {}),
          street: update['address.street'] || update.address?.street || docToUpdate.address?.street,
          city: update['address.city'] || update.address?.city || docToUpdate.address?.city,
          state: update['address.state'] || update.address?.state || docToUpdate.address?.state,
          country: update['address.country'] || update.address?.country || docToUpdate.address?.country,
          zip: update['address.zip'] || update.address?.zip || docToUpdate.address?.zip
        };
        
        // Create a temporary document to use geocoding method
        const tempDoc = new this.model({
          name: docToUpdate.name,
          address: updatedAddress
        });
        
        const location = await tempDoc.geocodeAddress();
        
        if (location) {
          // Add location to update
          if (!update.address) update.address = {};
          update.address.location = location;
          update.address.formattedAddress = tempDoc.address.formattedAddress;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in findOneAndUpdate geocoding:', error);
    next();
  }
});
clinicSchema.index({ 'address.location': '2dsphere' });
// ===== Export Model =====
const Clinic = mongoose.model("Clinic", clinicSchema);
export default Clinic;

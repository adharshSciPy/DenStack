import mongoose, { Schema } from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();

const CLINIC_ROLE = process.env.CLINIC_ROLE || "700";

const clinicSchema = new Schema(
  {
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
      lowercase: true,
      trim: true,
      unique: true,
      match: [/\S+@\S+\.\S+/, "Please provide a valid email"],
    },
    phoneNumber: {
      type: Number,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Phone number must be 10 digits"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [64, "Password cannot exceed 64 characters"],
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    theme: {
      startColor: {
        type: String,
        default: "#1E4D2B", // default gradient start
      },
      endColor: {
        type: String,
        default: "#3FA796", // default gradient end
      },
      primaryForeground: {
        type: String,
        default: "#ffffff", // text color on primary
      },
      sidebarForeground: {
        type: String,
        default: "#ffffff", // text color on sidebar
      },
      secondary:{
        type: String,
        default: "#3FA796", // text color on sidebar
      },
    },

    // createdBy: {
    //   type: Schema.Types.ObjectId,
    //   ref: "SuperAdmin",
    //   required: true,
    // },

    role: {
      type: String,
      default: CLINIC_ROLE,
    },

   subscription: {
  package: {
    type: String,
    enum: ["basic", "standard", "premium"],
    default: "basic",
  },
  type: {
    type: String,
    enum: ["monthly", "annual"],
    default: "monthly",
  },
  price: {
    type: Number,
    default: 0,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  nextBillingDate: {
    type: Date,
  },
  lastPaymentDate: {
    type: Date,
  },
  transactionId: {
    type: String, // useful if using Razorpay, Stripe, etc.
  },
},


    isActive: {
      type: Boolean,
      default: true,
    },
    staffs: {
      nurses: [{ type: Schema.Types.ObjectId, ref: "Nurse" }],
      receptionists: [{ type: Schema.Types.ObjectId, ref: "Reception" }],
      pharmacists: [{ type: Schema.Types.ObjectId, ref: "Pharmacist" }],
      accountants: [{ type: Schema.Types.ObjectId, ref: "Accountant" }],
      technicians: [{ type: Schema.Types.ObjectId, ref: "Technician" }]
    }


  },

  { timestamps: true }
);

// ====== Hooks ======
clinicSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// ====== Methods ======
clinicSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

clinicSchema.methods.getFullAddress = function () {
  const { street, city, state, country, zip } = this.address || {};
  return [street, city, state, country, zip].filter(Boolean).join(", ");
};

clinicSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.isActive;
};

clinicSchema.methods.generateAccessToken = function (role = CLINIC_ROLE) {
  return jwt.sign(
    {
      clinicId: this._id,
      name: this.name,
      email: this.email,
      role,
      subscription: this.subscription.package,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

clinicSchema.methods.generateRefreshToken = function (role = CLINIC_ROLE) {
  return jwt.sign(
    {
      clinicId: this._id,
      name: this.name,
      email: this.email,
      role,
      subscription: this.subscription.package,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};
clinicSchema.methods.activateSubscription = function (type = "monthly", pkg = "basic", price = 0) {
  const now = new Date();
  const endDate = new Date(now);

  if (type === "monthly") {
    endDate.setMonth(now.getMonth() + 1);
  } else if (type === "annual") {
    endDate.setFullYear(now.getFullYear() + 1);
  }

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


clinicSchema.methods.isSubscriptionValid = function () {
  return this.subscription?.isActive && new Date() < new Date(this.subscription.endDate);
};

clinicSchema.methods.cancelSubscription = function () {
  this.subscription.isActive = false;
  this.subscription.endDate = new Date();
  return this.subscription;
};
const Clinic = mongoose.model("Clinic", clinicSchema);

export default Clinic;

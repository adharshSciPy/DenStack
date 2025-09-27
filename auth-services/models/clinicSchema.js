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

    // createdBy: {
    //   type: Schema.Types.ObjectId,
    //   ref: "SuperAdmin",
    //   required: true,
    // },

role:{
type:String,
default:CLINIC_ROLE
},

    subscription: {
      package: {
        type: String,
        enum: ["basic", "standard", "premium"],
        default: "basic",
      },
      startDate: { type: Date, default: Date.now },
      endDate: { type: Date },
      isActive: { type: Boolean, default: true },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
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

const Clinic = mongoose.model("Clinic", clinicSchema);

export default Clinic;

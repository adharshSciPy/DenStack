import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const EcommerceUserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },

  password: {
    type: String,
    required: function () {
      return !this.isClinicUser && !this.isDoctorUser;
    },
  },

  phoneNumber: {
    type: String,
    required: function () {
      return !this.isClinicUser && !this.isDoctorUser;
    },
  },

  isClinicUser: { type: Boolean, default: false },
  isDoctorUser: { type: Boolean, default: false },

  DOB: String,
  specialization: String,
  clinicName: String,
  licenseNumber: String,

  role: { type: String, default: "user" },

  otp: String,
  otpExpires: Date,
});

// 🔐 Hash password
EcommerceUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ✅ ACCESS TOKEN (SHORT LIFE)
EcommerceUserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" } // ✅ FIXED
  );
};

// ✅ REFRESH TOKEN (LONG LIFE)
EcommerceUserSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // ✅ FIXED
  );
};

EcommerceUserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.model("EcommerceUser", EcommerceUserSchema);
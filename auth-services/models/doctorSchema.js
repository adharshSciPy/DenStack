import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const DOCTOR_ROLE = process.env.DOCTOR_ROLE || "600";

const doctorSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name must not exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [64, "Password cannot exceed 64 characters"],
    },
    phoneNumber: {
      type:Number,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^[6-9]\d{9}$/, "Phone number must be 10 digits"],
    },
    specialization: {
      type: String,
      trim: true,
      maxlength: [100, "Specialization cannot exceed 100 characters"],
    },
     licenseNumber: {
      type: String,
      required: [true, "License number is required"],
      unique: true,
      trim: true,
    },
    approve: {
      type: Boolean,
      default: true,
    },
    uniqueId:{
type:String,
required:true,
unique:true
    },
    role: {
      type: String,
      default: DOCTOR_ROLE,
    }},
  { timestamps: true }
);

// ====== Password hashing ======
doctorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ====== Methods ======
doctorSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

doctorSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { doctorId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

doctorSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { doctorId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

const Doctor = mongoose.model("Doctor", doctorSchema);
export default Doctor;

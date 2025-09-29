import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const RECEPTION_ROLE = process.env.RECEPTION_ROLE || "500";

const receptionSchema = new Schema(
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
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^[6-9]\d{9}$/, "Phone number must be 10 digits"],
    },
    employeeId: {
      type: String,
      unique: true,
      trim: true,
      maxlength: [20, "Employee ID cannot exceed 20 characters"],
    },
    shift: {
      type: String,
      enum: ["morning", "afternoon", "evening", "night"],
      trim: true,
    },
    role: {
      type: String,
      default: RECEPTION_ROLE,
    },
  },
  { timestamps: true }
);

// ====== Password hashing ======
receptionSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ====== Methods ======
receptionSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

receptionSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { receptionId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

receptionSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { receptionId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

const Reception = mongoose.model("Reception", receptionSchema);
export default Reception;
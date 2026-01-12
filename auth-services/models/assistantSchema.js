import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const ASSISTANT_ROLE = process.env.ASSISTANT_ROLE || "";

const assistantSchema = new Schema(
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
      type: Number,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^[6-9]\d{9}$/, "Phone number must be 10 digits"],
    },
    approve: {
      type: Boolean,
      default: true,
    },
    uniqueId: {
      type: String,
      required: true,
      unique: true,
    },
    permissions: {
      type: Object,
      default: {},
    },
    role: {
      type: String,
      default: ASSISTANT_ROLE,
    },
  },
  { timestamps: true }
);

// ====== Password hashing ======
assistantSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ====== Methods ======
assistantSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

assistantSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { proId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

assistantSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { proId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

const Assistant = mongoose.model("ASSISTANT", assistantSchema);
export default Assistant;

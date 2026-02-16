import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { type } from "os";

const EcommerceUserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.isClinicUser;
    }
  },
  phoneNumber: {
    type: String,
    required: function () {
      return !this.isClinicUser;
    }
  },
  isClinicUser: {
    type: Boolean,
    default: false
  },

  DOB: {
    type: String,
  },
  specialization: {
    type: String,
  },
  clinicName: {
    type: String,
  },
  licenseNumber: {
    type: String
  },
  role: {
    type: String,
    default: "user",
  }
});

EcommerceUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

EcommerceUserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      name: this.name,
      email: this.email,
      role: this.role
    },
    process.env.ACCESS_TOKEN_SECRET,
    // { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
  );
};
EcommerceUserSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      name: this.name,
      email: this.email,
      role: this.role
    },
    process.env.REFRESH_TOKEN_SECRET,
    // { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
  );
};

EcommerceUserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const EcommerceUser = mongoose.model("EcommerceUser", EcommerceUserSchema);
export default EcommerceUser;

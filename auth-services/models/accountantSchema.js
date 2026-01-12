import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const ACCOUNTANT_ROLE = process.env.ACCOUNTANT_ROLE || "400";
const shiftSchema = new Schema(
  {
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      validate: {
        validator: function (value) {
          // ✅ Accepts "09:00", "21:30", "09:00 AM", "11:15 PM"
          return /^([01]\d|2[0-3]):([0-5]\d)(\s?(AM|PM|am|pm))?$/.test(value);
        },
        message:
          "Invalid startTime format. Use 'HH:mm' (24-hour) or 'hh:mm AM/PM' format.",
      },
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      validate: {
        validator: function (value) {
          return /^([01]\d|2[0-3]):([0-5]\d)(\s?(AM|PM|am|pm))?$/.test(value);
        },
        message:
          "Invalid endTime format. Use 'HH:mm' (24-hour) or 'hh:mm AM/PM' format.",
      },
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
      validate: {
        validator: function (value) {
          return !isNaN(new Date(value).getTime());
        },
        message: "Invalid startDate. Please provide a valid date.",
      },
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return !isNaN(new Date(value).getTime());
        },
        message: "Invalid endDate. Please provide a valid date.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    archivedAt: { type: Date, default: null },
  },
  { _id: false }
);
shiftSchema.pre("validate", function (next) {
  if (this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }
  next();
});

const accountantSchema = new Schema(
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
    permissions: {
      type: Object,
      default: {},
    },
    shifts: [shiftSchema],
    role: {
      type: String,
      default: ACCOUNTANT_ROLE,
    },
  },
  { timestamps: true }
);

accountantSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

accountantSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};
accountantSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { doctorId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};
accountantSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { doctorId: this._id, name: this.name, email: this.email, role: this.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};
const Accountant = mongoose.model("Accountant", accountantSchema);
export default Accountant;

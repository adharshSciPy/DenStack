import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const PHARMACIST_ROLE = process.env.PHARMACIST_ROLE || "200";
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

const pharmacistSchema = new mongoose.Schema(
  {
    pharmacistId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    permissions: {
      type: Object,
      default: {},
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      default: PHARMACIST_ROLE,
    },
    shifts: [shiftSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// 🔹 Auto-generate pharmacistId before saving
pharmacistSchema.pre("save", async function (next) {
  if (!this.pharmacistId) {
    const lastPharmacy = await mongoose
      .model("Pharmacist")
      .findOne({}, {}, { sort: { createdAt: -1 } });
    let newId = "PHARM001";

    if (lastPharmacy && lastPharmacy.pharmacistId) {
      const lastNumber =
        parseInt(lastPharmacy.pharmacistId.replace("PHARM", "")) || 0;
      newId = "PHARM" + String(lastNumber + 1).padStart(3, "0");
    }

    this.pharmacistId = newId;
  }
  next();
});

// ====== Password hashing ======
pharmacistSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ====== Methods ======
pharmacistSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

pharmacistSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      pharmacistId: this._id,
      name: this.name,
      email: this.email,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

pharmacistSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      pharmacistId: this._id,
      name: this.name,
      email: this.email,
      role: this.role,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

const Pharmacist = mongoose.model("Pharmacist", pharmacistSchema);
export default Pharmacist;

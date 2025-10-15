import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const NURSE_ROLE = process.env.NURSE_ROLE || "300";

const shiftSchema = new Schema(
  {
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      validate: {
        validator: function (value) {
          // Accepts "09:00", "21:30", "09:00 AM", "11:15 PM"
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

// Validate that endDate >= startDate
shiftSchema.pre("validate", function (next) {
  if (this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }
  next();
});

const nurseSchema = new Schema(
    {
        // hospitalId: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "Hospital",
        //     required: true,
        // },
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
            maxlength: [50, "Name must not exceed 50 characters"],
        },
        nurseId: {
            type: String,
            unique: true
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
        role: {
            type: String,
            default: NURSE_ROLE,
        },
        shifts: [shiftSchema],
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// 🔹 Auto-generate nurseId before saving
nurseSchema.pre("save", async function (next) {
    if (!this.nurseId) {
        const lastNurse = await mongoose.model("Nurse").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "NURSE001";

        if (lastNurse && lastNurse.nurseId) {
            const lastNumber = parseInt(lastNurse.nurseId.replace("NURSE", "")) || 0;
            newId = "NURSE" + String(lastNumber + 1).padStart(3, "0");
        }

        this.nurseId = newId;
    }
    next();
});


// ====== Password hashing ======
nurseSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// ====== Methods ======
nurseSchema.methods.isPasswordCorrect = async function (password) {
    return bcrypt.compare(password, this.password);
};

nurseSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        { nurseId: this._id, name: this.name, email: this.email, role: this.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

nurseSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { nurseId: this._id, name: this.name, email: this.email, role: this.role },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

const Nurse = mongoose.model("Nurse", nurseSchema);
export default Nurse;

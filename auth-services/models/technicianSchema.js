import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const TECHNICIAN_ROLE = process.env.TECHNICIAN_ROLE || "400";

const technicianSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
            maxlength: [50, "Name must not exceed 50 characters"],
        },
        technicianId: {
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
        department: {
            type: String,
            enum: ["Dental Lab", "Radiology", "Sterilization", "General Assistance"]
        },
        specialization: {
            type: String,
            trim: true,
        },
        shift: {
            type: String,
            enum: ["Morning", "Evening", "Night", "Rotational"],
            default: "Morning",
        },
        experienceYears: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        role: {
            type: String,
            default: TECHNICIAN_ROLE,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// 🔹 Auto-generate nurseId before saving
technicianSchema.pre("save", async function (next) {
    if (!this.technicianId) {
        const lastTechnician = await mongoose.model("Technician").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "TECH001";

        if (lastTechnician && lastTechnician.technicianId) {
            const lastNumber = parseInt(lastTechnician.technicianId.replace("TECH", "")) || 0;
            newId = "TECH" + String(lastNumber + 1).padStart(3, "0");
        }

        this.technicianId = newId;
    }
    next();
});


// ====== Password hashing ======
technicianSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// ====== Methods ======
technicianSchema.methods.isPasswordCorrect = async function (password) {
    return bcrypt.compare(password, this.password);
};

technicianSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        { technicianId: this._id, name: this.name, email: this.email, role: this.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

technicianSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { technicianId: this._id, name: this.name, email: this.email, role: this.role },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

const Technician = mongoose.model("Technician", technicianSchema);
export default Technician;

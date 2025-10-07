import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const NURSE_ROLE = process.env.NURSE_ROLE || "300";

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
        // department: {
        //     type: String,
        //     required: true,
        // },
        // shift: {
        //     type: String,
        //     enum: ["Morning", "Afternoon", "Night", "Rotational"],
        //     default: "Morning",
        // },
        // qualification: {
        //     type: String,
        // },
        // experienceYears: {
        //     type: Number,
        //     default: 0,
        // },
        // assignedWard: {
        //     type: String,
        // },
        // isActive: {
        //     type: Boolean,
        //     default: true,
        // },
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

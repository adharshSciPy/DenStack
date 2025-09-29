import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const PHARMACIST_ROLE = process.env.PHARMACIST_ROLE || "200";

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
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            default: PHARMACIST_ROLE,
        },
        // hospitalId: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "Hospital",
        //     required: true,
        // },
        // licenseNumber: {
        //     type: String,
        //     required: true,
        //     unique: true,
        // },
        // shift: {
        //     type: String,
        //     enum: ["morning", "afternoon", "night"],
        //     default: "morning",
        // },
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
        const lastPharmacy = await mongoose.model("Pharmacist").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "PHARM001";

        if (lastPharmacy && lastPharmacy.pharmacistId) {
            const lastNumber = parseInt(lastPharmacy.pharmacistId.replace("PHARM", "")) || 0;
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
        { doctorId: this._id, name: this.name, email: this.email, role: this.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

pharmacistSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { doctorId: this._id, name: this.name, email: this.email, role: this.role },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

const Pharmacist = mongoose.model("Pharmacist", pharmacistSchema);
export default Pharmacist;

import mongoose, { Schema } from "mongoose"

const vendorSchema = new Schema(
    {
        vendorId: {
            type: String,
            unique: true,
        },

        // 🧍 Basic Info
        name: {
            type: String,
            required: [true, "Vendor name is required"],
            trim: true,
        },

        companyName: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/\S+@\S+\.\S+/, "Please provide a valid email"],
        },

        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"],
        },

        address: {
            street: String,
            city: String,
            state: String,
            pincode: String,
        },
        productsCount: {
            type: Number
        },
        totalRevenue: {
            type: Number
        },
        rating: {
            type: String
        },
        performance: {
            type: String
        },
        status: {
            type: String,
            enum: ["Active", "Inactive", "Pending"],
            default: "Active"
        },


        // 🗂️ Contact History (Super Admin → Vendor or vice versa)
        contactHistory: [
            {
                date: { type: Date, default: Date.now },
                contactMethod: {
                    type: String,
                    enum: ["call", "email", "meeting", "message"],
                    required: true,
                },
                summary: { type: String, trim: true },
                notes: { type: String, trim: true },
                contactedBy: { type: Number, default: process.env.SUPERADMIN_ROLE, trim: true },
            },
        ],
    },
    { timestamps: true }
);

// Auto-generate vendorId like "VEND#001"
vendorSchema.pre("save", async function (next) {
    if (!this.vendorId) {
        const lastVendor = await mongoose.model("Vendor").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "VEND#001";

        if (lastVendor && lastVendor.vendorId) {
            const lastNumber = parseInt(lastVendor.vendorId.split("#")[1]);
            const nextNumber = (lastNumber + 1).toString().padStart(3, "0");
            newId = `VEND#${nextNumber}`;
        }

        this.vendorId = newId;
    }
    next();
});


const Vendor = mongoose.model("Vendor", vendorSchema);
export default Vendor;
import mongoose from "mongoose";

const pharmacyVendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    contactNumber: String,
    email: String,
    address: String,
    licenseNumber: String,
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PharmacyVendor", pharmacyVendorSchema);

import mongoose from "mongoose";

const LabVendor = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    services: {
      type: [String], // e.g. ["Crown", "Bridge", "Denture"]
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);


LabVendor.index({ name: 1 });

export default mongoose.model("LabVendor", LabVendor);

import mongoose from "mongoose";

const alignerOrderSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabVendor",
      required: true
    },

    doctorName: String,
    clinicName: String,

    trays: {
      upperArch: Number,
      lowerArch: Number
    },

    treatmentDuration: String,

    // ✅ STL FILES ADDED HERE
    stlFiles: {
      upper: {
        type: String, // file path
      },
      lower: {
        type: String,
      },
      total: {
        type: String,
      }
    },

    status: {
      type: String,
      enum: [
        "draft",
        "approved",
        "manufacturing",
        "shipped",
        "in-treatment",
        "completed"
      ],
      default: "draft"
    },

    notes: String,

    totalAmount: Number,

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("AlignerOrder", alignerOrderSchema);

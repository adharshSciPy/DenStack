import mongoose from "mongoose";

const consentFormSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    fileUrl: {
      type: String, // Cloudinary / S3 URL
      required: true,
    },

    fileType: {
      type: String, // pdf, image
      enum: ["pdf", "image"],
      default: "pdf",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic", // clinic admin
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("ConsentForm", consentFormSchema);
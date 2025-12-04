import mongoose from "mongoose";

const ClinicProductSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "General",
    },
    mainCategory: {
      type: String,
    },
    subCategory: {
      type: String,
    },
    brand: {
      type: String,
    },
    price: {
      type: Number,
      default: 0,
    },
    isLocal: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
    },
    productType:{
      type: String,
      enum:["local","global"],
      default:"local"
    },
  },
  { timestamps: true }
);

export default mongoose.model("ClinicProduct", ClinicProductSchema);

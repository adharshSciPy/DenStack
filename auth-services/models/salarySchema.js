import mongoose, { Schema } from "mongoose";

const salarySchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: [
        "nurse",
        "receptionist",
        "pharmacist",
        "accountant",
        "technician",
        "doctor"
      ],
      required: true,
    },

    salaryAmount: {
      type: Number,
      required: true,
    },

    note: {
      type: String,
      maxlength: 300,
    },

    month: {
      type: String, // "2026-01"
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Salary", salarySchema);
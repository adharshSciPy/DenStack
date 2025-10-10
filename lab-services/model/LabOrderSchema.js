// models/LabOrder.js
import mongoose from "mongoose";

const labOrderSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: "LabVendor", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    patientId: { type: String, required: true }, // coming from patient microservice
    orderType: { type: String, required: true },
    toothNumbers: [{ type: String }],
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: "Consultation" },
    status: {
      type: String,
      enum: [
        "Pending", // order created but not yet accepted
        "Accepted", // lab accepted the order
        "In Progress", // work started
        "Ready for Delivery", // completed, waiting for pickup/delivery
        "Delivered", // delivered back to clinic
        "Rejected",
      ],
      default: "Pending",
    },
    statusHistory: [
      {
        status: String,
        date: { type: Date, default: Date.now },
        note: String,
      },
    ],

    expectedDeliveryDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("LabOrder", labOrderSchema);

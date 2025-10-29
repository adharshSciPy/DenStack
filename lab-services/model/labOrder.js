// models/DentalLabOrder.js
import mongoose from "mongoose";

const dentalLabOrderSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabVendor",
      required: true,
    },
    dentist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientName: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Patient",
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    note: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "ready", "delivered", "cancelled"],
      default: "pending",
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
     resultFiles: [
      {
        fileName: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate order number
dentalLabOrderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    this.orderNumber = `DLAB-${Date.now()}`;
  }
  next();
});

const DentalLabOrder = mongoose.model("DentalLabOrder", dentalLabOrderSchema);
export default DentalLabOrder;

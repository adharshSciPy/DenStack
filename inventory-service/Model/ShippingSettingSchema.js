import mongoose from "mongoose";

const shippingSettingsSchema = new mongoose.Schema({
  shippingCharge: {
    type: Number,
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  }
}, { timestamps: true });

export default mongoose.model("ShippingSettings", shippingSettingsSchema);
import mongoose from "mongoose";

const clinicInventorySchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("ClinicInventory", clinicInventorySchema);

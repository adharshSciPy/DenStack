import mongoose from "mongoose";

const clinicInventorySchema = new mongoose.Schema(
  {
    clinicId: { type: String, required: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, default: 0 },

    inventoryType: {
      type: String,
      enum: ["general", "pharmacy", "lab", "radiology", "others"],
      default: "general",
    },
    isLowStock: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 20 },
    assignedTo: {
      type: String,
      default: null,
    },
    productType: {
      type: String,
      enum: ["global", "local"],
      default: "global",
    }, 
  },
  { timestamps: true }
);

export default mongoose.model("ClinicInventory", clinicInventorySchema);

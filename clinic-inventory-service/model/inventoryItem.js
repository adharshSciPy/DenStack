import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    clinicId: {
      type: String,
      required: true,
    },
    // categoryId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "InventoryCategory",
    //   required: true,
    // },
    name: { type: String, required: true },
    supplier: { type: String, required: true },
    unitCost: { type: Number, required: true },
    currentStock: { type: Number, required: true, default: 0 },
    minimumStock: { type: Number, required: true, default: 5 },
    reorderLevel: { type: Number, default: 10 },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryItem", inventoryItemSchema);

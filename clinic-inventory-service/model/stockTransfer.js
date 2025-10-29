import mongoose from "mongoose";

const stockTransferSchema = new mongoose.Schema(
  {
    clinicId: { type: String, required: true }, // track which clinic
    item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    from: { type: String, default: "Clinic Inventory" }, // source
    to: { type: String, required: true }, // e.g., "Pharmacy", "Laboratory"
    quantity: { type: Number, required: true },
    transferredBy: { type: String, required: true }, // admin who did the transfer
    date: { type: Date, default: Date.now },
    movementType: { type: String, enum: ["distribution", "adjustment"], default: "distribution" }, // optional
    reference: { type: mongoose.Schema.Types.ObjectId }, // optional: link to PurchaseOrder or other
  },
  { timestamps: true }
);

export default mongoose.model("StockTransfer", stockTransferSchema);

import mongoose from "mongoose";

const clinicInventorySchema = new mongoose.Schema({
    clinicId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, default: 0 },

    inventoryType: {
        type: String,
        enum: ["general", "pharmacy", "lab", "radiology", "others"],
        default: "general"
    },

    assignedTo: {
        type: String,
        default: null 
    }
}, { timestamps: true });

export default mongoose.model("ClinicInventory", clinicInventorySchema);

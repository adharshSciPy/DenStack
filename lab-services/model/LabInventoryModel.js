import mongoose from "mongoose";

const labInventorySchema = new mongoose.Schema(
    {
        labId: {
            type: String,
            required: true
        },

        productName: {
            type: String,
            required: true
        },

        quantity: {
            type: Number,
            default: 0
        },

        lowStock: {
            type: Boolean,
            default: false
        },
        productId: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("LabInventory", labInventorySchema);
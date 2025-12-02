import mongoose from "mongoose";

const clinicPurchaseOrderSchema = new mongoose.Schema({
    clinicId: String,
    items: [
        {
            itemId: mongoose.Schema.Types.ObjectId,
            quantity: Number,
            unitCost: Number,
            totalCost: Number,
        }
    ],
    totalAmount: Number,
    status: {
        type: String,
        enum: ["PENDING", "DELIVERED", "CANCELLED"],
        default: "PENDING"  
    },
}, { timestamps: true });

export default mongoose.model("ClinicPurchaseOrder", clinicPurchaseOrderSchema);

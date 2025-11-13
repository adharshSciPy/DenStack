import mongoose from "mongoose";

const clinicPurchaseOrderSchema = new mongoose.Schema({
    clinicId: String,
    items: [
        {
            productId: mongoose.Schema.Types.ObjectId,
            quantity: Number,
            price: Number
        }
    ],
    totalAmount: Number,
    status: {
        type: String,
        enum: ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"],
        default: "PENDING"
    },
}, { timestamps: true });

export default mongoose.model("ClinicPurchaseOrder", clinicPurchaseOrderSchema);

import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema({
    orderId: {
        type: String,
        unique: true
    },
    superadminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SuperAdmin",
    },
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Clinic",
        // required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        // required: true
    },
    items: [
        {
            itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            quantity: Number,
            unitCost: Number,
            totalCost: Number
        },
    ],
    totalAmount: { type: Number },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "PENDING_REFUND"], default: "PENDING" },
    priorityLevel: {
        type: String,
        enum: ["STANDARD", "HIGH", "LOW"],
        default: "STANDARD"
    },
    orderStatus: { type: String, enum: ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], default: "PROCESSING" },
}, { timestamps: true })

// 🔵 Auto-generate orderId like "ORD-2025-001"
orderSchema.pre("save", async function (next) {
    if (!this.orderId) {
        const currentYear = new Date().getFullYear(); // e.g., 2025

        // Find last order for this year
        const lastOrder = await mongoose
            .model("Order")
            .findOne(
                {
                    orderId: { $regex: `^ ORD - ${currentYear} -` }
                }, // match same-year orders
                {},
                { sort: { createdAt: -1 } }
            );

        let newOrderId = `ORD - ${currentYear}-001`; // default first ID

        if (lastOrder && lastOrder.orderId) {
            const lastNumber = parseInt(lastOrder.orderId.split("-")[2]); // "001"
            const nextNumber = (lastNumber + 1).toString().padStart(3, "0");
            newOrderId = `ORD - ${currentYear} -${nextNumber}`;
        }

        this.orderId = newOrderId;
    }

    next();
});

const Order = new mongoose.model("Order", orderSchema);
export default Order;

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
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
    },
    items: [
        {
            itemId: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: "Product" 
            },
            quantity: {
                type: Number,
                required: true,
                min: 1
            },
            unitCost: {
                type: Number,
                required: true,
                min: 0
            },
            totalCost: {
                type: Number,
                required: true,
                min: 0
            }
        },
    ],
    totalAmount: { 
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: { 
        type: String, 
        enum: ["PENDING", "PAID", "PENDING_REFUND"], 
        default: "PENDING" 
    },
    priorityLevel: {
        type: String,
        enum: ["STANDARD", "HIGH", "LOW"],
        default: "STANDARD"
    },
    orderStatus: { 
        type: String, 
        enum: ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], 
        default: "PROCESSING" 
    },
}, { timestamps: true });

// 🔵 Auto-generate orderId like "ORD-2025-001"
orderSchema.pre("save", async function (next) {
    if (!this.orderId) {
        const currentYear = new Date().getFullYear();

        // ✅ Fixed regex - no spaces in pattern
        const lastOrder = await mongoose
            .model("Order")
            .findOne(
                {
                    orderId: { $regex: `^ORD-${currentYear}-` }
                },
                {},
                { sort: { createdAt: -1 } }
            );

        let newOrderId = `ORD-${currentYear}-001`; // ✅ Consistent format, no spaces

        if (lastOrder && lastOrder.orderId) {
            // ✅ Split by "-" correctly: ["ORD", "2025", "001"]
            const parts = lastOrder.orderId.split("-");
            const lastNumber = parseInt(parts[2]); // Get "001" part
            
            if (!isNaN(lastNumber)) {
                const nextNumber = (lastNumber + 1).toString().padStart(3, "0");
                newOrderId = `ORD-${currentYear}-${nextNumber}`;
            }
        }

        this.orderId = newOrderId;
    }

    next();
});

// ✅ Fixed model definition - remove 'new' keyword
const Order = mongoose.model("Order", orderSchema);
export default Order;
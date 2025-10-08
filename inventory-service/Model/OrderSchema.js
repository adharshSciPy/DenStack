import mongoose, { Schema } from "mongoose"

const orderSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic" },
    items: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            quantity: Number,
            price: Number,
        },
    ],
    totalAmount: { type: Number },
    paymentStatus: { type: String, enum: ["PENDING", "PAID"], default: "PENDING" },
    orderStatus: { type: String, enum: ["PROCESSING", "SHIPPED", "DELIVERED"], default: "PROCESSING" },
})

const Order = new mongoose.model("Order", orderSchema);
export default Order;
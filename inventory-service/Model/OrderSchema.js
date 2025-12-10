import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
  },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      quantity: Number,
      unitCost: Number,
      totalCost: Number,
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
      },
    },
  ],
  totalAmount: { type: Number },
  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID", "PENDING_REFUND"],
    default: "PENDING",
  },
  orderStatus: {
    type: String,
    enum: ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
    default: "PROCESSING",
  },
});

const Order = new mongoose.model("Order", orderSchema);
export default Order;

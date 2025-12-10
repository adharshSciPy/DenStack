import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        message: { type: String, required: true },
        isRead: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
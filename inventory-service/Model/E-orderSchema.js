import mongoose, { Schema } from "mongoose";

// Order Item Sub-Schema
const orderItemSchema = new Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    variant: {
        variantId: mongoose.Schema.Types.ObjectId,
        size: String,
        color: String,
        material: String
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    totalCost: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String
    }
}, { _id: true });

// Shipping Address Sub-Schema
const shippingAddressSchema = new Schema({
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    addressLine2: {
        type: String
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        default: "India"
    }
}, { _id: false });

// Payment Details Sub-Schema
const paymentDetailsSchema = new Schema({
    method: {
        type: String,
        enum: ["COD", "ONLINE", "UPI", "CARD", "WALLET"],
        required: true
    },
    transactionId: {
        type: String
    },
    status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
        default: "PENDING"
    },
    paidAt: {
        type: Date
    }
}, { _id: false });

// Main Order Schema
const orderSchema = new Schema(
    {
        orderId: {
            type: String,
            unique: true
        },
        clinic: {  // ✅ Changed from 'user' to 'clinic'
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            // This will be the clinic ID from auth microservice
        },
        clinicDetails: {  // ✅ Added to store fetched clinic info
            name: String,
            email: String,
            phone: String,
            address: String
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: function(v) {
                    return v && v.length > 0;
                },
                message: 'Order must have at least one item'
            }
        },
        shippingAddress: {
            type: shippingAddressSchema,
            required: true
        },
        paymentDetails: {
            type: paymentDetailsSchema,
            required: true
        },
        orderStatus: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"],
            default: "PENDING"
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },
        shippingCharge: {
            type: Number,
            default: 0,
            min: 0
        },
        tax: {
            type: Number,
            default: 0,
            min: 0
        },
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        orderNotes: {
            type: String
        },
        trackingNumber: {
            type: String
        },
        estimatedDelivery: {
            type: Date
        },
        deliveredAt: {
            type: Date
        },
        cancelledAt: {
            type: Date
        },
        cancellationReason: {
            type: String
        }
    },
    { timestamps: true }
);

// Auto-generate order ID
orderSchema.pre("save", async function (next) {
    if (!this.orderId) {
        const last = await mongoose.model("EcomOrder").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "EORD#0001";  // ✅ Changed to EORD for E-commerce Order
        if (last && last.orderId) {
            const num = parseInt(last.orderId.split("#")[1]);
            newId = `EORD#${(num + 1).toString().padStart(4, "0")}`;
        }
        this.orderId = newId;
    }
    next();
});

// Auto-update deliveredAt when status changes to DELIVERED
orderSchema.pre("save", function (next) {
    if (this.isModified('orderStatus')) {
        if (this.orderStatus === 'DELIVERED' && !this.deliveredAt) {
            this.deliveredAt = new Date();
        }
        if (this.orderStatus === 'CANCELLED' && !this.cancelledAt) {
            this.cancelledAt = new Date();
        }
    }
    next();
});

// Index for faster queries
orderSchema.index({ clinic: 1, createdAt: -1 });  // ✅ Changed from 'user' to 'clinic'
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'paymentDetails.status': 1 });

const EcomOrder = mongoose.model("EcomOrder", orderSchema);
export default EcomOrder;
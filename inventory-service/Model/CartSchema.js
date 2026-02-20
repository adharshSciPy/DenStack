import mongoose, { Schema } from "mongoose";

// Cart Item Sub-Schema
const cartItemSchema = new Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    variant: {
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            default: null
        },
        size: String,
        color: String,
        material: String,
        price: {
            type: Number,
            required: true
        }
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

// Main Cart Schema
const cartSchema = new Schema(
    {
        clinic: {
            type: mongoose.Schema.Types.ObjectId,
            required: false, // ✅ Changed to false
            default: null
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: false, // ✅ Changed to false
            default: null
        },
        items: {
            type: [cartItemSchema],
            default: []
        },
        totalItems: {
            type: Number,
            default: 0
        },
        subtotal: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

// ✅ Add validation: At least one of clinic or user must be present
cartSchema.pre("save", function (next) {
    if (!this.clinic && !this.user) {
        next(new Error("Either clinic or user is required"));
    } else {
        next();
    }
});

// Auto-calculate totals before saving
cartSchema.pre("save", function (next) {
    this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.subtotal = this.items.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
    next();
});

// Index for faster queries
cartSchema.index({ clinic: 1 });
cartSchema.index({ user: 1 });

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
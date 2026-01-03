import mongoose, { Schema } from "mongoose";

const topSellingProductSchema = new Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    salesCount: {
        type: Number,
        default: 0
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const TopSellingProduct = mongoose.model("TopSellingProduct", topSellingProductSchema);
export default TopSellingProduct;
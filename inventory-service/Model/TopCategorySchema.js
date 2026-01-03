import mongoose, { Schema } from "mongoose";

const topCategorySchema = new Schema({
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        required: true
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

const TopCategory = mongoose.model("TopCategory", topCategorySchema);
export default TopCategory;
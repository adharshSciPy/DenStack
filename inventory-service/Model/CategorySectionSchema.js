import mongoose, { Schema } from "mongoose";

const categorySectionSchema = new Schema({
    sectionTitle: {
        type: String,
        required: [true, "Section title is required"],
        trim: true
        // Example: "Category 1", "Category 2", "Electronics", "Fashion"
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }],
    displayType: {
        type: String,
        enum: ["grid", "slider", "list"],
        default: "grid"
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    productsLimit: {
        type: Number,
        default: 12
        // How many products to show in this section
    }
}, { timestamps: true });

const CategorySection = mongoose.model("CategorySection", categorySectionSchema);
export default CategorySection;
import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema({
    categoryName: {
        type: String,
        required: [true, "Category name is required"],
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true
    },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
}, { timestamps: true })

const Category = mongoose.model("Category", categorySchema);
export default Category;
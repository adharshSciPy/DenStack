import mongoose, { Schema } from "mongoose";

const brandSchema = new Schema({
    brandId: {
        type: String,
        unique: true
    },
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    mainCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "MainCategory", 
        required: true 
    },
    subCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SubCategory",  // ✅ CHANGED from "MainCategory" to "SubCategory"
        required: true 
    },
    image: { 
        type: String,
        default: null  // Optional now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Auto-generate brandId
brandSchema.pre('save', async function(next) {
    if (!this.brandId) {
        this.brandId = `BRAND_${Date.now()}`;
    }
    next();
});

const Brand = mongoose.model("Brand", brandSchema);
export default Brand;
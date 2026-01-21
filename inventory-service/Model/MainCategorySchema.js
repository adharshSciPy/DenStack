import mongoose from 'mongoose';

const mainCategorySchema = new mongoose.Schema({
    mainCategoryId: { type: String, unique: true },
    categoryName: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    image: { type: String, default: null },  // ✅ Added image field
    parentCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'MainCategory',
        default: null  // null = main, value = sub
    },
    level: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

mainCategorySchema.pre('save', async function(next) {
    if (!this.mainCategoryId) {
        this.mainCategoryId = `MCAT_${Date.now()}`;
    }
    next();
});

export default mongoose.model('MainCategory', mainCategorySchema);
import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema({
    subCategoryId: {
        type: String,
        unique: true
    },
    categoryName: {
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
        ref: 'MainCategory',
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

// Auto-generate subCategoryId
subCategorySchema.pre('save', async function(next) {
    if (!this.subCategoryId) {
        this.subCategoryId = `SCAT_${Date.now()}`;
    }
    next();
});

// ✅ CREATE AND EXPORT THE MODEL
const SubCategory = mongoose.model('SubCategory', subCategorySchema);
export default SubCategory;
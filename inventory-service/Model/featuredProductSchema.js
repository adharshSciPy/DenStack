import mongoose, { Schema } from "mongoose";

const featuredProductSchema = new Schema(
    {
        featuredProductId: {
            type: String,
            unique: true
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        title: {
            type: String,
            trim: true,
            // Optional custom title, defaults to product name if not provided
        },
        description: {
            type: String,
            // Optional custom description
        },
        badge: {
            type: String,
            enum: ["NEW", "HOT", "SALE", "TRENDING", "EXCLUSIVE", null],
            default: null
        },
        order: {
            type: Number,
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true
        },
        startDate: {
            type: String,
            default: Date.now
        },
        endDate: {
            type: String,
            default: null  // null means no end date
        }
    },
    { timestamps: true }
);

// Auto-generate featuredProductId
featuredProductSchema.pre("save", async function (next) {
    if (!this.featuredProductId) {
        const last = await mongoose.model("FeaturedProduct").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "FPROD#001";
        if (last && last.featuredProductId) {
            const num = parseInt(last.featuredProductId.split("#")[1]);
            newId = `FPROD#${(num + 1).toString().padStart(3, "0")}`;
        }
        this.featuredProductId = newId;
    }
    next();
});

// Check if featured product is still valid (not expired)
featuredProductSchema.methods.isValid = function () {
    if (!this.isActive) return false;
    if (this.endDate && new Date() > this.endDate) return false;
    return true;
};

// Index for faster queries
featuredProductSchema.index({ product: 1 });
featuredProductSchema.index({ isActive: 1, order: 1 });

const FeaturedProduct = mongoose.model("FeaturedProduct", featuredProductSchema);
export default FeaturedProduct;
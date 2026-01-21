import mongoose, { Schema } from "mongoose";

// Variant Sub-Schema
const variantSchema = new Schema({
    size: {
        type: String,
        default: null
    },
    color: {
        type: String,
        default: null
    },
    material: {
        type: String,
        default: null
    },
    originalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discountPrice1: {
        type: Number,
        default: null,
        min: 0
    },
    discountPrice2: {
        type: Number,
        default: null,
        min: 0
    },
    discountPercentage1: {
        type: Number,
        default: null,
        min: 0,
        max: 100
    },
    discountPercentage2: {
        type: Number,
        default: null,
        min: 0,
        max: 100
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: true });

const productSchema = new Schema(
    {
        productId: {
            type: String,
            unique: true,
        },
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
        },
        brand: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Brand", 
            required: true 
        },
        mainCategory: {
            type: Schema.Types.ObjectId,
            ref: "MainCategory",
            required: true,
        },
        subCategory: {
            type: Schema.Types.ObjectId,
            ref: "SubCategory",
            required: true,
        },
        description: {
            type: String,
            default: ""
        },
        variants: {
            type: [variantSchema],
            required: true,
            validate: {
                validator: function(v) {
                    return v && v.length > 0;
                },
                message: 'Product must have at least one variant'
            }
        },
        image: [{ type: String, required: true }],
        expiryDate: {
            type: Date
        },
        status: {
            type: String,
            enum: ["Available", "Out of Stock", "Discontinued", "Expired"],
            default: "Available",
        },
        isLowStock: { 
            type: Boolean, 
            default: false 
        }
    },
    { timestamps: true }
);

// Auto-generate product ID
productSchema.pre("save", async function (next) {
    if (!this.productId) {
        const last = await mongoose.model("Product").findOne({}, {}, { sort: { createdAt: -1 } });
        let newId = "PROD#001";
        if (last && last.productId) {
            const num = parseInt(last.productId.split("#")[1]);
            newId = `PROD#${(num + 1).toString().padStart(3, "0")}`;
        }
        this.productId = newId;
    }
    next();
});

// Validate subcategory belongs to main category
productSchema.pre("save", async function (next) {
    if (this.subCategory) {
        const SubCategory = mongoose.model("SubCategory");

        const subCat = await SubCategory.findById(this.subCategory);
        if (!subCat)
            return next(new Error("Invalid Sub Category ID"));

        if (!subCat.mainCategory)
            return next(new Error("Selected Sub Category has no main category"));

        if (String(subCat.mainCategory) !== String(this.mainCategory)) {
            return next(
                new Error("Sub Category does not belong to selected Main Category")
            );
        }
    }

    next();
});

// Auto-update status based on stock or expiry
productSchema.pre("save", function (next) {
    const today = new Date();
    
    // Check expiry
    if (this.expiryDate && this.expiryDate < today) {
        this.status = "Expired";
    } 
    // Check total stock across all variants
    else {
        const totalStock = this.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
        
        if (totalStock <= 0) {
            this.status = "Out of Stock";
        } else if (totalStock <= 10) {
            this.status = "Available";
            this.isLowStock = true;
        } else {
            this.status = "Available";
            this.isLowStock = false;
        }
    }
    
    next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;
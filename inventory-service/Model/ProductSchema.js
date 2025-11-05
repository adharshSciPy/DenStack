import mongoose, { Schema } from "mongoose";

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
        brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        description: {
            type: String
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        stock: {
            type: Number,
            default: 0,
        },
        image: {
            type: String
        },

        expiryDate: {
            type: Date
        },
        status: {
            type: String,
            enum: ["Available", "Out of Stock", "Discontinued", "Expired"],
            default: "Available",
        },
        isLowStock: { type: Boolean, default: false }
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

// Auto-update status based on stock or expiry
productSchema.pre("save", function (next) {
    const today = new Date();
    if (this.expiryDate && this.expiryDate < today) this.status = "Expired";
    else if (this.stock <= 0) this.status = "Out of Stock";
    else this.status = "Available";
    next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;

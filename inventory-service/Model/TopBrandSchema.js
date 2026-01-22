import mongoose, { Schema } from "mongoose";

const topBrandSchema = new Schema({
    brandId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },
    imageUrl: {
        type: String
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

const TopBrand = mongoose.model("TopBrand", topBrandSchema);
export default TopBrand;

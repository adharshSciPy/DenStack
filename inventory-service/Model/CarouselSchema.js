import mongoose, { Schema } from "mongoose";

const carouselSchema = new Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true
    },
    subtitle: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String,
        required: [true, "Image is required"]
    },
    linkUrl: {
        type: String,
        trim: true
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

const Carousel = mongoose.model("Carousel", carouselSchema);
export default Carousel;
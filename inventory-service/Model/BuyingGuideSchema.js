import mongoose, { Schema } from 'mongoose';

const BuyingGuideSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    description: { type: String, required: true },
    productCount: { type: Number, required: true },
    mainImage: { type: String },

    sections: [
        {
            heading: { type: String, required: true },
            content: { type: String, required: true },
            image: { type: String }
        }
    ],

    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            name: String,
            image: String
        }
    ]

}, { timestamps: true });


const BuyingGuide = mongoose.model('BuyingGuide', BuyingGuideSchema);

export default BuyingGuide;
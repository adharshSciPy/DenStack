import mongoose, { Schema } from "mongoose";

const StepProductSchema = new Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  name: { type: String },
  image: { type: String }
});

const StepSchema = new Schema({
  stepNumber: {
    type: Number,
    required: true
  },
  stepLabel: {
    type: String, // e.g. "STEP 1"
  },
  title: {
    type: String,
    required: true // "Diagnostic Evaluation and Treatment Planning"
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String // left-side step image
  },
  products: [StepProductSchema]
});

const BuyingGuideSchema = new Schema(
  {
    title: {
      type: String,
      required: true // Buying Guide main title
    },
    subtitle: {
      type: String
    },
    description: {
      type: String
    },
    mainImage: {
      type: String
    },

    steps: [StepSchema]
  },
  { timestamps: true }
);

const BuyingGuide = mongoose.model("BuyingGuide", BuyingGuideSchema);
export default BuyingGuide;

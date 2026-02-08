import mongoose, { Schema } from "mongoose";

const favoriteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    // Store variant information if needed
    variantId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate favorites
favoriteSchema.index({ user: 1, product: 1 }, { unique: true });


const Favorite = mongoose.model("Favorite", favoriteSchema);
export default Favorite;
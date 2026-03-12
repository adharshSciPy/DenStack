import mongoose from "mongoose";

const usedBySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAccount",
      default: null,
    },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    usedAt: { type: Date, default: Date.now },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EcomOrder",
      default: null,
    },
  },
  { _id: false }
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    discountType: {
      type: String,
      enum: ["percent", "flat"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"],
    },
    usageLimit: {
      type: Number,
      required: [true, "Usage limit is required"],
      min: [1, "Usage limit must be at least 1"],
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usedBy: {
      type: [usedBySchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAccount",
      default: null,
    },
  },
  { timestamps: true }
);

// Virtual: how many times this coupon has been used
couponSchema.virtual("usageCount").get(function () {
  return this.usedBy.length;
});

// Virtual: derived status
couponSchema.virtual("status").get(function () {
  if (new Date() > this.expiryDate) return "expired";
  if (this.usedBy.length >= this.usageLimit) return "exhausted";
  if (!this.isActive) return "inactive";
  return "active";
});

couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

// Index for fast code lookups
couponSchema.index({ code: 1 });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
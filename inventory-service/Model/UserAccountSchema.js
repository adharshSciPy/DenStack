import mongoose, { Schema } from 'mongoose';

// ── Address sub-schema ────────────────────────────────────────────────────────
const AddressSchema = new Schema(
  {
    label:      { type: String, default: 'Home' },   // e.g. Home, Clinic, Office
    fullName:   { type: String, required: true },
    phone:      { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    city:       { type: String, required: true },
    state:      { type: String, required: true },
    pincode:    { type: String, required: true },
    country:    { type: String, default: 'India' },
    isDefault:  { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

// ── Wishlist item sub-schema ───────────────────────────────────────────────────
const WishlistItemSchema = new Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    addedAt:   { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Main UserAccount schema ───────────────────────────────────────────────────
const UserAccountSchema = new Schema(
  {
    firstName:      { type: String },
    lastName:       { type: String },
    email:          { type: String, unique: true },
    password:       { type: String },                // hashed — keep existing field
    phoneNumber:    { type: Number },
    DOB:            { type: String },
    specialization: { type: String },
    clinicName:     { type: String },
    licenseNumber:  { type: String },

    // ✅ NEW
    addresses: { type: [AddressSchema], default: [] },
    wishlist:  { type: [WishlistItemSchema], default: [] },
  },
  { timestamps: true }
);

const UserAccount = mongoose.model('UserAccount', UserAccountSchema);
export default UserAccount;
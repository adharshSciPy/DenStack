import mongoose from "mongoose";

const pharmacyInventorySchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: String,         // NO middleware required
      required: true,       // Must be sent manually in POST/PUT requests
    },

    productName: {
    type: String,
    ref: "Medicine",   // <-- FIXED
    required: true,
  },


    productId: {
      type: String,
      required: false,
    },


    quantity: {
      type: Number,
      required: true,
      default: 0,
    },


    clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
  },
  
    inventoryType: {
      type: String,
      default: "pharmacy"
    }
  },
  { timestamps: true }
);

// Virtual field for low stock (< 15)
pharmacyInventorySchema.virtual("isLowStock").get(function () {
  return this.quantity < 15;
});

export default mongoose.model("PharmacyInventory", pharmacyInventorySchema);
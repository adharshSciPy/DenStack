import mongoose from "mongoose";

const inventoryCategorySchema = new mongoose.Schema({
  clinicId: {
    type: String, // coming from Clinic microservice
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

export default mongoose.model("InventoryCategory", inventoryCategorySchema);

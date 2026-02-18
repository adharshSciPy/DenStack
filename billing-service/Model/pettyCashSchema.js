import mongoose from "mongoose";

const pettyCashSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    purpose: {
      type: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { timestamps: true }
);

export default mongoose.model("PettyCash", pettyCashSchema);
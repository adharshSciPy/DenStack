import mongoose from "mongoose";

const blogSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  title: String,
  content: String,
  imageUrl: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Blog", blogSchema);

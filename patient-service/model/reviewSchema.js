import mongoose, { Schema } from "mongoose";
const reviewSchema = new Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
  },
  patientName: { type: String, required: true },
  stars: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  createdAt: { type: Date, default: Date.now },
});

const Review = mongoose.model("Review", reviewSchema);
export default Review;

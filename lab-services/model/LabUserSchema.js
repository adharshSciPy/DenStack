import mongoose from "mongoose";

const LabUserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: {
      type: String, // 600 = Lab Admin, 650 = Lab Staff (example)
      default: "101",
    },
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lab",
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
    },
  },
  { timestamps: true }
);

export default mongoose.model("LabUser", LabUserSchema);

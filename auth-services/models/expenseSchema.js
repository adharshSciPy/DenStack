import mongoose, { Schema } from "mongoose";

const expenseSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    category: {
      type: String,
      enum: [
        "equipment",
        "product",
        "medicine",
        "rent",
        "electricity",
        "internet",
        "other",
      ],
      default: "other",
    },

    // Product/Equipment/Medicine name (optional)
    productName: {
      type: String,
      trim: true,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Who added it (varies by token type in this codebase)
    addedBy: {
      type: Schema.Types.ObjectId,
    },
    addedByRole: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
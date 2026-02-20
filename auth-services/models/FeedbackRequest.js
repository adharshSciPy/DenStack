import mongoose, { Schema } from "mongoose";

const URGENT_KEYWORDS = [
  "malpractice", "negligence", "lawyer", "sue", "lawsuit",
  "killed", "died", "death", "wrong medication", "overdose",
  "harassment", "abuse", "police", "complaint", "refund",
];

const feedbackRequestSchema = new Schema(
  {
    // ── Tenant ────────────────────────────────────────────────────────────────
    hospitalId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Hospital",
      required: true,
      index:    true,
    },

    // ── Token & Lifecycle ─────────────────────────────────────────────────────
    uniqueToken: { type: String, required: true, unique: true, index: true },
    status:      { type: String, enum: ["pending", "completed", "expired"], default: "pending", index: true },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating:       { type: Number, min: 1, max: 5 },
    reviewType:   { type: String, enum: ["positive", "negative", null], default: null },
    feedbackText: { type: String, maxlength: 2000 },

    // ── Admin resolution ──────────────────────────────────────────────────────
    isResolved: { type: Boolean, default: false },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    adminNotes: { type: String, maxlength: 2000 },

    // ── Urgency ───────────────────────────────────────────────────────────────
    isUrgent:       { type: Boolean, default: false },
    urgentKeywords: [String],

    // ── Visit context ─────────────────────────────────────────────────────────
    patientName:  { type: String, required: true },
    patientPhone: { type: String },
    doctorName:   { type: String, required: true },
    department:   { type: String },
    visitDate:    { type: Date, required: true },
    generatedBy:  { type: String },
    googlePlaceId: { type: String, default: null },

    // ── Timestamps ────────────────────────────────────────────────────────────
    expiresAt:   { type: Date, required: true, index: true },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

// Tenant-scoped compound indexes
feedbackRequestSchema.index({ hospitalId: 1, reviewType: 1, isResolved: 1 });
feedbackRequestSchema.index({ hospitalId: 1, isUrgent: 1,  isResolved: 1 });
feedbackRequestSchema.index({ hospitalId: 1, doctorName: 1, submittedAt: -1 });
feedbackRequestSchema.index({ hospitalId: 1, status: 1, expiresAt: 1 });

feedbackRequestSchema.statics.detectUrgentKeywords = function (text = "") {
  const lower = text.toLowerCase();
  return URGENT_KEYWORDS.filter((kw) => lower.includes(kw));
};

const FeedbackRequest = mongoose.model("FeedbackRequest", feedbackRequestSchema);
export default FeedbackRequest;
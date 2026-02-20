import crypto from "crypto";
import Joi from "joi";
import FeedbackRequest from "../models/FeedbackRequest.js";
import Clinic from "../models/clinicSchema.js"

// ─── Validation Schemas ───────────────────────────────────────────────────────

const generateSchema = Joi.object({
  patientName:  Joi.string().min(2).max(100).required(),
  patientPhone: Joi.string().optional().allow(""),
  doctorName:   Joi.string().min(2).max(100).required(),
  department:   Joi.string().max(100).optional().allow(""),
  visitDate:    Joi.date().max("now").required(),
});

const submitSchema = Joi.object({
  token:        Joi.string().uuid().required(),
  rating:       Joi.number().integer().min(1).max(5).required(),
  feedbackText: Joi.string().max(2000).optional().allow(""),
});

// ─── POST /api/v1/feedback/generate ──────────────────────────────────────────
const generateFeedbackLink = async (req, res) => {
  try {
    const { error, value } = generateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    const feedback = await FeedbackRequest.create({
      hospitalId:   req.hospital._id,
      googlePlaceId: req.hospital.googlePlaceId || null,
      uniqueToken:  token,
      expiresAt,
      generatedBy:  req.user?.name || req.user?.email || "Receptionist",
      patientName:  value.patientName,
      patientPhone: value.patientPhone || null,
      doctorName:   value.doctorName,
      department:   value.department || null,
      visitDate:    value.visitDate,
    });

    const link = `${process.env.CLIENT_URL}/feedback/${token}`;

    return res.status(201).json({
      success:     true,
      message:     "Feedback link generated successfully",
      link,
      token,
      expiresAt,
      patientName: feedback.patientName,
      doctorName:  feedback.doctorName,
    });

  } catch (error) {
    console.error("❌ Error in generateFeedbackLink:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// ─── GET /api/v1/feedback/:token ─────────────────────────────────────────────
const getFeedbackContext = async (req, res) => {
  try {
    const { token } = req.params;

    const feedback = await FeedbackRequest
      .findOne({ uniqueToken: token })
      .select("patientName doctorName department visitDate status expiresAt");

    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback link not found" });
    }
    if (feedback.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: "This feedback link has expired" });
    }
    if (feedback.status === "completed") {
      return res.status(409).json({ success: false, message: "Feedback already submitted" });
    }

    return res.status(200).json({
      success:     true,
      patientName: feedback.patientName,
      doctorName:  feedback.doctorName,
      department:  feedback.department,
      visitDate:   feedback.visitDate,
      expiresAt:   feedback.expiresAt,
    });
  } catch (error) {
    console.error("❌ Error in getFeedbackContext:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// ─── POST /api/v1/feedback/submit ────────────────────────────────────────────
// ─── POST /api/v1/feedback/submit ────────────────────────────────────────────
const submitFeedback = async (req, res) => {
  try {
    const { error, value } = submitSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { token, rating, feedbackText } = value;

    // ── No .populate() needed anymore ────────────────────────────────────────
    const feedback = await FeedbackRequest.findOne({ uniqueToken: token });

    if (!feedback)                       return res.status(404).json({ success: false, message: "Feedback link not found" });
    if (feedback.status === "completed") return res.status(409).json({ success: false, message: "Feedback already submitted" });
    if (feedback.expiresAt < new Date()) {
      await FeedbackRequest.updateOne({ _id: feedback._id }, { status: "expired" });
      return res.status(410).json({ success: false, message: "This feedback link has expired" });
    }

    const isNegative      = rating <= 3;
    const reviewType      = isNegative ? "negative" : "positive";
    const matchedKeywords = isNegative ? FeedbackRequest.detectUrgentKeywords(feedbackText) : [];
    const isUrgent        = matchedKeywords.length > 0;

    feedback.rating      = rating;
    feedback.reviewType  = reviewType;
    feedback.status      = "completed";
    feedback.submittedAt = new Date();

    if (isNegative && feedbackText?.trim()) feedback.feedbackText = feedbackText.trim();
    if (isUrgent) {
      feedback.isUrgent       = true;
      feedback.urgentKeywords = matchedKeywords;
    }

    await feedback.save();

    const io = req.app.get("io");
    if (io && isNegative) {
      io.to(`admin_room_${feedback.hospitalId}`).emit("new_negative_review", {
        feedbackId:     feedback._id.toString(),
        patientName:    feedback.patientName,
        doctorName:     feedback.doctorName,
        rating,
        feedbackText:   feedback.feedbackText || null,
        isUrgent,
        urgentKeywords: matchedKeywords,
        submittedAt:    feedback.submittedAt,
      });
    }

    // ── Google Place ID now comes from req.hospital (the Clinic doc) ──────────
  //  const clinic         = await Clinic.findById(feedback.hospitalId).select("googlePlaceId").lean();
const googlePlaceId = feedback.googlePlaceId || null;

return res.status(200).json({
  success:         true,
  message:         isNegative
    ? "Thank you for your feedback. Our team will review it shortly."
    : "Thank you! We'd love if you shared your experience on Google.",
  reviewType,
  isUrgent,
  googleReviewUrl: (!isNegative && googlePlaceId)
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : null,
});
  } catch (err) {
    console.error("❌ submitFeedback:", err);
    return res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};

export { generateFeedbackLink, getFeedbackContext, submitFeedback };

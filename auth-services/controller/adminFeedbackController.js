import FeedbackRequest from "../models/FeedbackRequest.js";

// ─── GET /api/v1/admin/feedback ───────────────────────────────────────────────
const getAllFeedback = async (req, res) => {
  try {
    let { page, limit, reviewType, isResolved, isUrgent, doctorName, rating, startDate, endDate, search } = req.query;

    page  = parseInt(page)  || 1;
    limit = parseInt(limit) || 20;

    const filter = { status: "completed" };

    if (reviewType)                  filter.reviewType = reviewType;
    if (isResolved !== undefined)    filter.isResolved = isResolved === "true";
    if (isUrgent && isUrgent !== "") filter.isUrgent   = isUrgent  === "true";
    if (doctorName)                  filter.doctorName = { $regex: doctorName, $options: "i" };
    if (rating)                      filter.rating     = parseInt(rating);

    if (startDate || endDate) {
      filter.submittedAt = {};
      if (startDate) filter.submittedAt.$gte = new Date(startDate);
      if (endDate)   filter.submittedAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { patientName:  { $regex: search, $options: "i" } },
        { feedbackText: { $regex: search, $options: "i" } },
        { doctorName:   { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [feedbackList, total] = await Promise.all([
      FeedbackRequest.find(filter)
        .sort({ isUrgent: -1, submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FeedbackRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      success:  true,
      message:  "Feedback fetched successfully",
      data:     feedbackList,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("❌ Error in getAllFeedback:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// ─── GET /api/v1/admin/feedback/pending ──────────────────────────────────────
const getPendingLinks = async (req, res) => {
  try {
    const pending = await FeedbackRequest.find({
      status:    "pending",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("patientName doctorName department visitDate createdAt expiresAt generatedBy")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Pending links fetched successfully",
      data:    pending,
    });
  } catch (error) {
    console.error("❌ Error in getPendingLinks:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// ─── GET /api/v1/admin/feedback/analytics ────────────────────────────────────
const getFeedbackAnalytics = async (req, res) => {
  try {
    let { period } = req.query;
    period = parseInt(period) || 30;

    const since     = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const baseMatch = { status: "completed", submittedAt: { $gte: since } };

    const [totals, ratingDist, byDoctor, dailyTrend, urgentUnresolved, totalUnresolved] =
      await Promise.all([

        FeedbackRequest.aggregate([
          { $match: baseMatch },
          { $group: {
            _id:       null,
            total:     { $sum: 1 },
            positive:  { $sum: { $cond: [{ $eq: ["$reviewType", "positive"] }, 1, 0] } },
            negative:  { $sum: { $cond: [{ $eq: ["$reviewType", "negative"] }, 1, 0] } },
            avgRating: { $avg: "$rating" },
          }},
        ]),

        FeedbackRequest.aggregate([
          { $match: baseMatch },
          { $group: { _id: "$rating", count: { $sum: 1 } } },
          { $sort:  { _id: 1 } },
        ]),

        FeedbackRequest.aggregate([
          { $match: baseMatch },
          { $group: {
            _id:       "$doctorName",
            total:     { $sum: 1 },
            avgRating: { $avg: "$rating" },
            positive:  { $sum: { $cond: [{ $eq: ["$reviewType", "positive"] }, 1, 0] } },
            negative:  { $sum: { $cond: [{ $eq: ["$reviewType", "negative"] }, 1, 0] } },
            urgent:    { $sum: { $cond: ["$isUrgent", 1, 0] } },
          }},
          { $sort: { avgRating: 1 } },
        ]),

        FeedbackRequest.aggregate([
          { $match: baseMatch },
          { $group: {
            _id:       { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
            total:     { $sum: 1 },
            positive:  { $sum: { $cond: [{ $eq: ["$reviewType", "positive"] }, 1, 0] } },
            negative:  { $sum: { $cond: [{ $eq: ["$reviewType", "negative"] }, 1, 0] } },
            avgRating: { $avg: "$rating" },
          }},
          { $sort: { _id: 1 } },
        ]),

        FeedbackRequest.countDocuments({ isUrgent: true,        isResolved: false, status: "completed" }),
        FeedbackRequest.countDocuments({ reviewType: "negative", isResolved: false, status: "completed" }),
      ]);

    const summary = totals[0] || { total: 0, positive: 0, negative: 0, avgRating: 0 };

    // NPS = (Promoters 4–5⭐ − Detractors 1–2⭐) / Total × 100
    const [promoters, detractors] = await Promise.all([
      FeedbackRequest.countDocuments({ ...baseMatch, rating: { $gte: 4 } }),
      FeedbackRequest.countDocuments({ ...baseMatch, rating: { $lte: 2 } }),
    ]);

    const nps = summary.total > 0
      ? Math.round(((promoters - detractors) / summary.total) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      message: "Analytics fetched successfully",
      data: {
        period,
        summary: {
          ...summary,
          avgRating:        Math.round((summary.avgRating || 0) * 10) / 10,
          nps,
          urgentUnresolved,
          totalUnresolved,
        },
        ratingDistribution: ratingDist,
        byDoctor,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("❌ Error in getFeedbackAnalytics:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// ─── GET /api/v1/admin/feedback/:id ──────────────────────────────────────────
const getFeedbackById = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await FeedbackRequest.findById(id).lean();
    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    return res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    console.error("❌ Error in getFeedbackById:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// ─── PATCH /api/v1/admin/feedback/resolve/:id ────────────────────────────────
const resolveFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const feedback = await FeedbackRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          isResolved: true,
          resolvedBy: req.user?.name || req.user?.email || "Clinic Admin",
          resolvedAt: new Date(),
          ...(adminNotes?.trim() && { adminNotes: adminNotes.trim() }),
        },
      },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    console.log(`[Admin] Feedback ${id} resolved by ${req.user?.name || req.user?.email}`);

    return res.status(200).json({
      success:  true,
      message:  "Feedback resolved successfully",
      data:     feedback,
    });
  } catch (error) {
    console.error("❌ Error in resolveFeedback:", error);
    return res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

export { getAllFeedback, getPendingLinks, getFeedbackAnalytics, getFeedbackById, resolveFeedback };

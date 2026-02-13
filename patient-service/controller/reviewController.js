import Patient from "../model/patientSchema.js";
import Review from "../model/reviewSchema.js";
export const getReviewByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const patient = await Patient.findOne({ reviewToken: token }).select(
      "name isReviewed clinicId"
    );

    if (!patient)
      return res.status(404).json({
        success: false,
        message: "Invalid review link"
      });

    return res.json({
      success: true,
      patient
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const submitReview = async (req, res) => {
  try {
    const { token } = req.params;
    const { rating, comment,name } = req.body;

    const patient = await Patient.findOne({ reviewToken: token });

    if (!patient)
      return res.status(404).json({
        success: false,
        message: "Invalid token"
      });

    if (patient.isReviewed)
      return res.status(400).json({
        success: false,
        message: "Already reviewed"
      });

    // 🔹 Save review
    await Review.create({
      patientId: patient._id,
      clinicId: patient.clinicId,
      stars: rating,
      comment,
      patientName: patient.name
    });

    // 🔹 mark reviewed
    patient.isReviewed = true;
    await patient.save();

    // 🔹 update clinic rating average
    // const reviews = await Review.find({ clinicId: patient.clinicId });

    // const avg =
    //   reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    // await Clinic.updateOne(
    //   { _id: patient.clinicId },
    //   {
    //     ratingAvg: avg,
    //     totalReviews: reviews.length
    //   }
    // );

    return res.json({
      success: true,
      message: "Review submitted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getClinicReviews = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const reviews = await Review.find({ clinicId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      reviews
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    await Review.findByIdAndDelete(reviewId);

    res.json({
      success: true,
      message: "Review deleted"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review)
      return res.status(404).json({ success: false, message: "Review not found" });

    review.status = "approved";
    await review.save();

    // 🔹 recalc rating only for approved reviews
    const reviews = await Review.find({
      clinicId: review.clinicId,
      status: "approved"
    });

    // const avg =
    //   reviews.reduce((sum, r) => sum + r.stars, 0) / (reviews.length || 1);

    // await Clinic.updateOne(
    //   { _id: review.clinicId },
    //   {
    //     ratingAvg: avg,
    //     totalReviews: reviews.length
    //   }
    // );

    res.json({
      success: true,
      message: "Review approved"
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    await Review.findByIdAndUpdate(reviewId, {
      status: "rejected"
    });

    res.json({
      success: true,
      message: "Review rejected"
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

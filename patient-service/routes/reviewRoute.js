import express from "express";
import {
  getReviewByToken,
  submitReview,
  getClinicReviews,
  deleteReview,
  approveReview,
  rejectReview
} from "../controller/reviewController.js";

const router = express.Router();

router.get("/:token", getReviewByToken);
router.post("/:token", submitReview);
router.get("/clinic/:clinicId", getClinicReviews);
router.delete("/:reviewId", deleteReview);
router.patch("/:reviewId/approve", approveReview);
router.patch("/:reviewId/reject", rejectReview);

export default router;

import { Router } from "express";
import {
  getAllFeedback,
  getPendingLinks,
  getFeedbackAnalytics,
  getFeedbackById,
  resolveFeedback,
} from "../controller/adminFeedbackController.js";
import { authClinicAdminFeedback, authFeedbackStaff } from "../middleware/feedbackAuth.js";

const adminFeedbackRouter = Router();

// Clinic Admin — view all completed reviews (with filters + pagination)
adminFeedbackRouter.route("/").get(authClinicAdminFeedback, getAllFeedback);

// Receptionist + Clinic Admin — links generated but patient hasn't responded yet
adminFeedbackRouter.route("/pending").get(authFeedbackStaff, getPendingLinks);

// Clinic Admin — NPS, rating breakdown, per-doctor stats, daily trend
adminFeedbackRouter.route("/analytics").get(authClinicAdminFeedback, getFeedbackAnalytics);

// Clinic Admin — single review detail
adminFeedbackRouter.route("/:id").get(authClinicAdminFeedback, getFeedbackById);

// Clinic Admin — mark a negative review as resolved with optional notes
adminFeedbackRouter.route("/resolve/:id").patch(authClinicAdminFeedback, resolveFeedback);

export default adminFeedbackRouter;

import { Router } from "express";
import resolveTenant from "../middleware/resolveTenant.js";
import {
  generateFeedbackLink,
  getFeedbackContext,
  submitFeedback,
} from "../controller/feedbackController.js";
import { authReceptionist } from "../middleware/feedbackAuth.js";

const feedbackRouter = Router();

// Receptionist — generate a unique feedback link for a patient (manual sharing)
feedbackRouter.post(
  "/generate",
  authReceptionist,
  resolveTenant,   // 🔥 THIS IS MISSING
  generateFeedbackLink
);

// Public — patient opens the link, page loads their context (doctor name, etc.)
feedbackRouter.route("/:token").get(getFeedbackContext);

// Public — patient submits their star rating + optional text
feedbackRouter.route("/submit").post(submitFeedback);

export default feedbackRouter;

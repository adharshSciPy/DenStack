import { Router } from "express";
import resolveTenant from "../middleware/resolveTenant.js";
import {
  generateFeedbackLink,
  getFeedbackContext,
  submitFeedback,
} from "../controller/feedbackController.js";
import { authReceptionistOrAdmin } from "../middleware/feedbackAuth.js";

const feedbackRouter = Router();

// Receptionist — generate a unique feedback link
feedbackRouter.post("/generate", authReceptionistOrAdmin, resolveTenant, generateFeedbackLink);

// Public — patient submits their rating
feedbackRouter.post("/submit", submitFeedback);

// Public — patient opens the link (dynamic route always last)
feedbackRouter.get("/:token", getFeedbackContext);

export default feedbackRouter;
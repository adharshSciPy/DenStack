import { Router } from "express";
import {
  uploadConsentForm,
  getConsentFormsByClinic,
  deleteConsentForm,
} from "../controller/consentController.js";

import { upload } from "../middleware/upload.js";
import authorizeRoles from "../middleware/roleBasedMiddleware.js";

const consentRouter = Router();

// ==============================
// 📤 Upload Consent Forms
// ==============================
consentRouter.route("/upload-consent-form").post(
  authorizeRoles("700","500"),
  upload.array("files", 10), // ✅ FIXED
  uploadConsentForm
);

// ==============================
// 📥 Get Consent Forms
// ==============================
consentRouter.route("/clinic-consent-forms").get(
  authorizeRoles("700","500"),
  getConsentFormsByClinic
);

// ==============================
// ❌ Delete Consent Form
// ==============================
consentRouter.route("/delete-consent-form/:id").delete(
  authorizeRoles("700","500"),
  deleteConsentForm
);

export default consentRouter;
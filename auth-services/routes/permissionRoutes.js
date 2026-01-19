import express from "express";
import { authClinicAdmin } from "../middleware/authClinicAdmin.js";
import {
  updatePermissions,
  getPermissions,
  getAllClinicStaff,
  getPermissionsInternal,
  verifyInternalService
} from "../controller/permissionController.js";

const router = express.Router();

/* ================= ADMIN ROUTES ================= */
router.get("/permissions", authClinicAdmin, getPermissions);
router.patch("/permissions-update", authClinicAdmin, updatePermissions);
router.get("/clinic-staff/:clinicId", authClinicAdmin, getAllClinicStaff);

/* ================= INTERNAL SERVICE ROUTE ================= */
router.get(
  "/internal/permissions",
  verifyInternalService,
  getPermissionsInternal
);

export default router;
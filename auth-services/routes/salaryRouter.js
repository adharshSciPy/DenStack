import express from "express";
import {
  addStaffSalary,
  getTotalSalary,
  getMonthlySalaryReport
} from "../controller/salaryController.js";
import { verifyAuthToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * Add or update doctor salary (Clinic Admin / Super Admin)
 */
router.post("/add", verifyAuthToken, addStaffSalary);

/**
 * Same endpoint (alias – optional)
 */
router.post("/doctor/add-salary", verifyAuthToken, addStaffSalary);

/**
 * Get total salary (all doctors)
 */
router.get("/total", verifyAuthToken, getTotalSalary);

/**
 * Get month-wise salary report
 */
router.get("/monthly", verifyAuthToken, getMonthlySalaryReport);

export default router;
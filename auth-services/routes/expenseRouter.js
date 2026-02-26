import express from "express";
import { verifyAuthToken } from "../middleware/auth.js";
import {
  addExpense,
  getMonthlyExpenseReport,
  getTotalExpense,
  getClinicExpensesByMonth
} from "../controller/expenseController.js";

const router = express.Router();

// Add extra finances / expense
router.post("/add", verifyAuthToken, addExpense);

// Total expense
router.get("/total", verifyAuthToken, getTotalExpense);

// Month-wise expense report
router.get("/monthly", verifyAuthToken, getMonthlyExpenseReport);

// Get expenses for a specific clinic and month
router.get("/clinic/month/:clinicId", verifyAuthToken, getClinicExpensesByMonth);

export default router;
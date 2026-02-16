import mongoose from "mongoose";
import Expense from "../models/expenseSchema.js";

export const addExpense = async (req, res) => {
  try {
    const { amount, category, productName, paymentDate, note } =
      req.body || {};

    // clinic admin token includes clinicId; super admin token does not.
    const tokenClinicId = req.user?.clinicId;
    const finalClinicId = tokenClinicId ;
    if (!finalClinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required (missing from token/body).",
      });
    }

    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: "amount is required and must be a number",
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "paymentDate is required (YYYY-MM-DD)",
      });
    }

    const parsedDate = new Date(paymentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "paymentDate must be a valid date (YYYY-MM-DD)",
      });
    }

    const expense = await Expense.create({
      clinicId: new mongoose.Types.ObjectId(finalClinicId),
      amount: Number(amount),
      category: category || "other",
      productName: productName || "",
      paymentDate: parsedDate,
      note: note || "",
      addedBy: req.user?.clinicId || req.user?.id || req.user?.doctorId,
      addedByRole: req.user?.role,
    });

    return res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getTotalExpense = async (req, res) => {
  try {
    const clinicIdFromToken = req.user?.clinicId;
    const clinicIdFromQuery = req.query?.clinicId;
    const clinicId = clinicIdFromQuery || clinicIdFromToken;

    const matchStage = {};
    if (clinicId) {
      matchStage.clinicId = new mongoose.Types.ObjectId(clinicId);
    }

    const result = await Expense.aggregate([
      { $match: matchStage },
      { $group: { _id: null, totalExpense: { $sum: "$amount" } } },
    ]);

    return res.status(200).json({
      success: true,
      totalExpense: result[0]?.totalExpense || 0,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getMonthlyExpenseReport = async (req, res) => {
  try {
    const clinicIdFromToken = req.user?.clinicId;
    const clinicIdFromQuery = req.query?.clinicId;
    const clinicId = clinicIdFromQuery || clinicIdFromToken;

    const matchStage = {};
    if (clinicId) {
      matchStage.clinicId = new mongoose.Types.ObjectId(clinicId);
    }

    const report = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$paymentDate" },
            month: { $month: "$paymentDate" },
          },
          totalExpense: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: {
            $arrayElemAt: [
              [
                "",
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ],
              "$_id.month",
            ],
          },
          totalExpense: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
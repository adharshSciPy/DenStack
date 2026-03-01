import axios from "axios";
import mongoose from "mongoose";
import Salary from "../models/salarySchema.js";


export const addStaffSalary = async (req, res) => {
  try {
    const { staffId, salaryAmount, note, month, role } = req.body;
    const { clinicId, role: userRole } = req.user;

    // 🔐 Admin only
    if (String(userRole) !== String(process.env.CLINIC_ROLE)) {
      return res.status(403).json({
        success: false,
        message: "Only clinic admin can add staff salary",
      });
    }

    if (!staffId || !salaryAmount || !month || !role) {
      return res.status(400).json({
        success: false,
        message: "staffId, role, salaryAmount and month are required",
      });
    }

    // ✅ Allowed roles (extra safety)
    const allowedRoles = [
      "doctor",
      "nurse",
      "receptionist",
      "pharmacist",
      "accountant",
      "technician",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff role",
      });
    }


    // 🧾 Duplicate check
    const exists = await Salary.findOne({
      clinicId,
      staffId,
      month,
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Salary already added for this staff in this month",
      });
    }

    // 💰 Save salary
    const salary = await Salary.create({
      clinicId,
      staffId,
      role,
      salaryAmount,
      note: note || "",
      month,
    });

    return res.status(201).json({
      success: true,
      message: "Salary added successfully",
      data: salary,
    });
  } catch (error) {
    console.error("❌ Salary Controller Crash:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTotalSalary = async (req, res) => {
  try {
    // Clinic scope
    const clinicIdFromToken = req.user?.clinicId;
    const clinicIdFromQuery = req.query?.clinicId;
    const clinicId = clinicIdFromQuery || clinicIdFromToken;

    const matchStage = {};
    if (clinicId) {
      matchStage.clinicId = new mongoose.Types.ObjectId(clinicId);
    }

    const result = await Salary.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSalary: { $sum: "$salaryAmount" },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      totalSalary: result[0]?.totalSalary || 0,
    });
  } catch (error) {
    console.error("❌ getTotalSalary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch total salary",
    });
  }
};


/**
 * MONTH-WISE salary report
 */
export const getMonthlySalaryReport = async (req, res) => {
  try {
    const clinicIdFromToken = req.user?.clinicId;
    const clinicIdFromQuery = req.query?.clinicId;
    const clinicId = clinicIdFromQuery || clinicIdFromToken;

    const matchStage = { role: "doctor" };
    if (clinicId) {
      matchStage.clinicId = new mongoose.Types.ObjectId(clinicId);
    }

    // month is stored as "YYYY-MM" in Salary
    const report = await Salary.aggregate([
      { $match: matchStage },
      { $group: { _id: "$month", totalSalary: { $sum: "$salaryAmount" } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: "$_id", totalSalary: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


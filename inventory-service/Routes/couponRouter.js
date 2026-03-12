// ============================================
// Routes/couponRouter.js
// ============================================

import express from "express";
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js";
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  generateCouponCode,
  getCouponUsers,
  validateCoupon,
  applyCoupon,
  getCouponStats,
} from "../Controller/couponController.js";

const couponRouter = express.Router();

// ============= COUPON ROUTES =============

// ✅ Admin only - stats & code generation
couponRouter.get("/stats",         verifyAuthToken, authorizeRoles("admin"), getCouponStats);
couponRouter.get("/generate-code", verifyAuthToken, authorizeRoles("admin"), generateCouponCode);

// ✅ Admin only - CRUD
couponRouter.post("/create",       verifyAuthToken, authorizeRoles("admin"), createCoupon);
couponRouter.get("/getAll",        verifyAuthToken, authorizeRoles("admin"), getAllCoupons);
couponRouter.get("/getById/:id",   verifyAuthToken, authorizeRoles("admin"), getCouponById);
couponRouter.get("/users/:id",     verifyAuthToken, authorizeRoles("admin"), getCouponUsers);
couponRouter.put("/update/:id",    verifyAuthToken, authorizeRoles("admin"), updateCoupon);
couponRouter.delete("/delete/:id", verifyAuthToken, authorizeRoles("admin"), deleteCoupon);

// ✅ All users (doctor, clinic, normal user) - validate coupon (cart page — does NOT record usage)
couponRouter.post("/validate",     verifyAuthToken, validateCoupon);

// ✅ All users (doctor, clinic, normal user) - apply coupon (order confirm — records usage)
couponRouter.post("/apply",        verifyAuthToken, applyCoupon);

export default couponRouter;
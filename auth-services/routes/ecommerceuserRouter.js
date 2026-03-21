import { Router } from "express";
import {
  loginEcommerceUser,
  registerEcommerceUser,
  getProfile,
  editUserProfile,
  logoutUser, clinicMarketplaceLogin,
  doctorMarketplaceLogin,
  forgotEcomUserPassword,
  verifyEcomUserOTP,
  resetEcomUserPassword
} from "../controller/EcommerceUserController.js";
import { authMiddleware } from "../utils/auth.js";

const EcommerceUserRoutes = Router();
EcommerceUserRoutes.post("/register", registerEcommerceUser);
EcommerceUserRoutes.post("/login", loginEcommerceUser);
EcommerceUserRoutes.post("/clinic-marketplace-login", clinicMarketplaceLogin);
EcommerceUserRoutes.post("/doctor-marketplace-login", doctorMarketplaceLogin);


// 🔒 Protected route
EcommerceUserRoutes.get("/getProfile", authMiddleware, getProfile);
EcommerceUserRoutes.put("/edit-profile", authMiddleware, editUserProfile);

EcommerceUserRoutes.post("/logout", logoutUser);
EcommerceUserRoutes.post("/forgot-password", forgotEcomUserPassword);
EcommerceUserRoutes.post("/verify-otp",verifyEcomUserOTP);
EcommerceUserRoutes.post("/reset-password",resetEcomUserPassword);

export default EcommerceUserRoutes;

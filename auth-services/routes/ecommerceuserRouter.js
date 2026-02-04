import { Router } from "express";
import {
  loginEcommerceUser,
  registerEcommerceUser,
  getProfile,
  editUserProfile,
  logoutUser,
} from "../controller/EcommerceUserController.js";
import { authMiddleware } from "../utils/auth.js";

const EcommerceUserRoutes = Router();
EcommerceUserRoutes.post("/register", registerEcommerceUser);
EcommerceUserRoutes.post("/login", loginEcommerceUser);

// 🔒 Protected route
EcommerceUserRoutes.get("/getProfile", authMiddleware, getProfile);
EcommerceUserRoutes.put("/edit-profile", authMiddleware, editUserProfile);

EcommerceUserRoutes.post("/logout", logoutUser);

export default EcommerceUserRoutes;

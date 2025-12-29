import { Router } from "express";
import { loginSuperAdmin, registerSuperAdmin } from "../controller/superAdminController.js";
const superAdminAuthRoutes=Router();
superAdminAuthRoutes.route("/register").post(registerSuperAdmin);
superAdminAuthRoutes.route("/login").post(loginSuperAdmin);
export default superAdminAuthRoutes
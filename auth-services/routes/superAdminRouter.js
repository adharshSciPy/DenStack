import { Router } from "express";
import { loginSuperAdmin, registerSuperAdmin, getSalesMetrics, getSalesTrends, getMonthlySummary } from "../controller/superAdminController.js";
import { verifyAuthToken, authorizeRoles } from "../../inventory-service/middlewares/authmiddleware.js";
const SUPERADMIN = process.env.SUPERADMIN_ROLE
const superAdminAuthRoutes = Router();
superAdminAuthRoutes.route("/register").post(registerSuperAdmin);
superAdminAuthRoutes.route("/login").post(loginSuperAdmin);

superAdminAuthRoutes.get("/metrics", verifyAuthToken, authorizeRoles(SUPERADMIN), getSalesMetrics);
superAdminAuthRoutes.get("/trends", verifyAuthToken, authorizeRoles(SUPERADMIN), getSalesTrends);
superAdminAuthRoutes.get("/getMonthlySummary", getMonthlySummary)

export default superAdminAuthRoutes
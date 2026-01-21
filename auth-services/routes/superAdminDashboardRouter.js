import { Router } from "express";
import { getAdminDashboard, getMonthlySummary, 
  getClinicCount  } from "../controller/subscriptionController.js";

const superAdminDashboardRouter = Router();


superAdminDashboardRouter.route("/dashboard").get(getAdminDashboard);
// Monthly summary for overview charts
superAdminDashboardRouter.route("/monthly-summary").get(getMonthlySummary);

// Clinic count for overview
superAdminDashboardRouter.route("/clinic-count").get(getClinicCount);
// superAdminDashboardRouter.route("/subscription/test").post(createTestSubscription);


export default superAdminDashboardRouter;

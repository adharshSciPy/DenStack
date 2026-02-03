// ============================================
// routes/ecomOrderRoutes.js
// ============================================

import express from "express";
import { verifyAuthToken, authorizeRoles, canPlaceOrder } from "../middlewares/authMiddleware.js";
import {
    createEcomOrder,
    getAllEcomOrders,
    getEcomOrderById,
    getClinicEcomOrders,
    updateEcomOrderStatus,
    updateEcomPaymentStatus,
    cancelEcomOrder,
    getRecentEcomOrders,
    getEcomOrderAnalytics
} from "../Controller/EorderController.js";

const ecomOrderRouter = express.Router();

// ============= ECOM ORDER ROUTES =============

// ✅ USER ROUTES (Clinics and Clinic-Doctors)
ecomOrderRouter.post("/create", verifyAuthToken, canPlaceOrder, createEcomOrder);
ecomOrderRouter.get("/getById/:orderId", verifyAuthToken, getEcomOrderById);
ecomOrderRouter.get("/clinic/:clinicId", verifyAuthToken, getClinicEcomOrders);
ecomOrderRouter.put("/cancel/:orderId", verifyAuthToken, cancelEcomOrder);

// ✅ ADMIN ROUTES (Roles: 789, 999)
ecomOrderRouter.get("/getAll", verifyAuthToken, authorizeRoles('789', '999'), getAllEcomOrders);
ecomOrderRouter.get("/recent", verifyAuthToken, authorizeRoles('789', '999'), getRecentEcomOrders);
ecomOrderRouter.get("/analytics", verifyAuthToken, authorizeRoles('789', '999'), getEcomOrderAnalytics);
ecomOrderRouter.put("/updateStatus/:orderId", verifyAuthToken, authorizeRoles('789', '999'), updateEcomOrderStatus);
ecomOrderRouter.put("/updatePayment/:orderId", verifyAuthToken, authorizeRoles('789', '999'), updateEcomPaymentStatus);

export default ecomOrderRouter;
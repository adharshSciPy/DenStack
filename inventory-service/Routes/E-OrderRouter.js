// ============================================
// routes/ecomOrderRoutes.js
// ============================================

import express from "express";
import { verifyAuthToken, canPlaceOrder } from "../middlewares/authmiddleware.js";
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

// ✅ Create order - only clinics & clinic-doctors
ecomOrderRouter.post("/create", verifyAuthToken, canPlaceOrder, createEcomOrder);

// ✅ View orders - any authenticated user
ecomOrderRouter.get("/getAll", verifyAuthToken, getAllEcomOrders);
ecomOrderRouter.get("/recent", verifyAuthToken, getRecentEcomOrders);
ecomOrderRouter.get("/analytics", verifyAuthToken, getEcomOrderAnalytics);
ecomOrderRouter.get("/getById/:orderId", verifyAuthToken, getEcomOrderById);
ecomOrderRouter.get("/clinic/:clinicId", verifyAuthToken, getClinicEcomOrders);

// ✅ Manage orders - any authenticated user (for now)
ecomOrderRouter.put("/updateStatus/:orderId", verifyAuthToken, updateEcomOrderStatus);
ecomOrderRouter.put("/updatePayment/:orderId", verifyAuthToken, updateEcomPaymentStatus);
ecomOrderRouter.put("/cancel/:orderId", verifyAuthToken, cancelEcomOrder);

export default ecomOrderRouter;
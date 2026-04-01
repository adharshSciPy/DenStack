// ============================================
// routes/ecomOrderRoutes.js
// ============================================

import express from "express";
import { verifyAuthToken, canPlaceOrder } from "../middlewares/authMiddleware.js";
import {
    createEcomOrder,
    getAllEcomOrders,
    getEcomOrderById,
    getClinicEcomOrders,
    getUserEcomOrders,
    updateEcomOrderStatus,
    updateEcomPaymentStatus,
    cancelEcomOrder,
    getRecentEcomOrders,
    getEcomOrderAnalytics,
    getDeliveredProducts,
    getUserDeliveredOrders,
    getOrderStatus,
    updateOrderStatus,
    pricePreview,
    // ✅ NEW — admin dashboard APIs
    getOrderStats,
    getRecentOrders,
    getDashboardAnalytics,
} from "../Controller/EorderController.js";

const ecomOrderRouter = express.Router();

// ============= ADMIN DASHBOARD ROUTES =============
ecomOrderRouter.get("/orderStats",          verifyAuthToken, getOrderStats);
ecomOrderRouter.get("/recentOrders",        verifyAuthToken, getRecentOrders);
ecomOrderRouter.get("/dashboard-analytics", verifyAuthToken, getDashboardAnalytics);

// ============= ECOM ORDER ROUTES =============

// Create order
ecomOrderRouter.post("/create", verifyAuthToken, canPlaceOrder, createEcomOrder);

// View orders
ecomOrderRouter.get("/getAll",           verifyAuthToken, getAllEcomOrders);
ecomOrderRouter.get("/recent",           verifyAuthToken, getRecentEcomOrders);
ecomOrderRouter.get("/analytics",        verifyAuthToken, getEcomOrderAnalytics);
ecomOrderRouter.get("/getById/:orderId", verifyAuthToken, getEcomOrderById);
ecomOrderRouter.get("/status/:orderId",  verifyAuthToken, getOrderStatus);

// User orders
ecomOrderRouter.get("/user/:userId",         verifyAuthToken, getUserEcomOrders);
ecomOrderRouter.get("/user/deliver/:userId", verifyAuthToken, getUserDeliveredOrders);

// Clinic orders
ecomOrderRouter.get("/clinic/:clinicId",         verifyAuthToken, getClinicEcomOrders);
ecomOrderRouter.get("/clinic/deliver/:clinicId", verifyAuthToken, getDeliveredProducts);

// Price preview
ecomOrderRouter.post("/price-preview", verifyAuthToken, pricePreview);

// Manage orders
ecomOrderRouter.put("/updateStatus/:orderId",  verifyAuthToken, updateEcomOrderStatus);
ecomOrderRouter.put("/updatePayment/:orderId", verifyAuthToken, updateEcomPaymentStatus);
ecomOrderRouter.put("/update-status/:orderId", verifyAuthToken, updateOrderStatus);
ecomOrderRouter.put("/cancel/:orderId",        verifyAuthToken, cancelEcomOrder);

export default ecomOrderRouter;
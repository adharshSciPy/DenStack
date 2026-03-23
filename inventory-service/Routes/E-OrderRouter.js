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
    getUserEcomOrders,       // ✅ NEW
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
} from "../Controller/EorderController.js";

const ecomOrderRouter = express.Router();

// ============= ECOM ORDER ROUTES =============

// Create order
ecomOrderRouter.post("/create", verifyAuthToken, canPlaceOrder, createEcomOrder);

// View orders
ecomOrderRouter.get("/getAll",     verifyAuthToken, getAllEcomOrders);
ecomOrderRouter.get("/recent",     verifyAuthToken, getRecentEcomOrders);
ecomOrderRouter.get("/analytics",  verifyAuthToken, getEcomOrderAnalytics);
ecomOrderRouter.get("/getById/:orderId", verifyAuthToken, getEcomOrderById);
ecomOrderRouter.get("/status/:orderId",  verifyAuthToken, getOrderStatus);

// ✅ NEW — all orders for a user (used by OrderHistoryPage)
ecomOrderRouter.get("/user/:userId", verifyAuthToken, getUserEcomOrders);

// Clinic orders
ecomOrderRouter.get("/clinic/:clinicId",         verifyAuthToken, getClinicEcomOrders);
ecomOrderRouter.get("/clinic/deliver/:clinicId", verifyAuthToken, getDeliveredProducts);

// User delivered orders
ecomOrderRouter.get("/user/deliver/:userId", verifyAuthToken, getUserDeliveredOrders);

// Price preview
ecomOrderRouter.post("/price-preview", verifyAuthToken, pricePreview);

// Manage orders
ecomOrderRouter.put("/updateStatus/:orderId",  verifyAuthToken, updateEcomOrderStatus);
ecomOrderRouter.put("/updatePayment/:orderId", verifyAuthToken, updateEcomPaymentStatus);
ecomOrderRouter.put("/update-status/:orderId", verifyAuthToken, updateOrderStatus);
ecomOrderRouter.put("/cancel/:orderId",        verifyAuthToken, cancelEcomOrder);

export default ecomOrderRouter;
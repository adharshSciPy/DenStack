import express from "express";
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

// Create new ecom order
ecomOrderRouter.post("/create", createEcomOrder);

// Get all ecom orders (with filters and pagination)
ecomOrderRouter.get("/getAll", getAllEcomOrders);

// Get recent ecom orders
ecomOrderRouter.get("/recent", getRecentEcomOrders);

// Get ecom order analytics
ecomOrderRouter.get("/analytics", getEcomOrderAnalytics);

// Get ecom order by ID
ecomOrderRouter.get("/getById/:orderId", getEcomOrderById);

// Get user's ecom orders
ecomOrderRouter.get("/clinic/:clinicId", getClinicEcomOrders);

// Update ecom order status
ecomOrderRouter.put("/updateStatus/:orderId", updateEcomOrderStatus);

// Update ecom payment status
ecomOrderRouter.put("/updatePayment/:orderId", updateEcomPaymentStatus);

// Cancel ecom order
ecomOrderRouter.put("/cancel/:orderId", cancelEcomOrder);

export default ecomOrderRouter;
import { Router } from "express"
import { createOrder, getAllOrders, getUserOrders, cancelOrder, getOrdersByClinicId, getOrderStats, getRecentOrders } from "../Controller/orderController.js"
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js";
const CLINIC_ROLE = process.env.CLINIC_ROLE
const SUPERADMIN_ROLE = process.env.SUPERADMIN_ROLE

const orderRouter = Router();

orderRouter.post("/createOrder", verifyAuthToken, authorizeRoles(CLINIC_ROLE, SUPERADMIN_ROLE), createOrder)
orderRouter.get("/allOrders", verifyAuthToken, authorizeRoles(CLINIC_ROLE), getAllOrders);
orderRouter.get("/user/:userId", verifyAuthToken, authorizeRoles(CLINIC_ROLE), getUserOrders);
orderRouter.patch("/cancelOrder/:orderId", verifyAuthToken, authorizeRoles(CLINIC_ROLE), cancelOrder);
orderRouter.get("/clinic/:clinicId", verifyAuthToken, authorizeRoles(CLINIC_ROLE), getOrdersByClinicId);

orderRouter.get("/orderStats", verifyAuthToken, authorizeRoles(SUPERADMIN_ROLE), getOrderStats);
orderRouter.get("/recentOrders", verifyAuthToken, authorizeRoles(SUPERADMIN_ROLE), getRecentOrders);
export default orderRouter;
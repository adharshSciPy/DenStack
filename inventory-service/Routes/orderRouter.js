import { Router } from "express"
import { createOrder, getAllOrders, getUserOrders } from "../Controller/orderController.js"
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js";
const CLINIC_ROLE = process.env.CLINIC_ROLE

const orderRouter = Router();

orderRouter.post("/createOrder", verifyAuthToken, authorizeRoles(CLINIC_ROLE), createOrder)
orderRouter.get("/allOrders", verifyAuthToken, authorizeRoles(CLINIC_ROLE), getAllOrders);
orderRouter.get("/user/:userId", verifyAuthToken, authorizeRoles(CLINIC_ROLE), getUserOrders);


export default orderRouter;
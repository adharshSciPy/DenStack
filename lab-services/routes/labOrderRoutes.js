import { Router } from "express";
import { createLabOrder,updateOrderStatus,getPendingLabOrders } from "../controller/LabOrder.js";

const labOrderRouter = Router();

labOrderRouter.route("/create-order").post(createLabOrder);
labOrderRouter.route("/update-status/:orderId").patch(updateOrderStatus);
labOrderRouter.route("/pending-orders").get(getPendingLabOrders);


export default labOrderRouter;
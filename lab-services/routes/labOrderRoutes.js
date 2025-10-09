import { Router } from "express";
import { createLabOrder,updateOrderStatus } from "../controller/LabOrder.js";

const labOrderRouter = Router();

labOrderRouter.route("/create-order").post(createLabOrder);
labOrderRouter.route("/update-status/:orderId").patch(updateOrderStatus);


export default labOrderRouter;
import { Router } from "express";
import {
  createLabOrder,
  updateOrderStatus,
  getPendingLabOrders,
  getLabOrdersbyClinicId,
  getLabOrdersStatus,
  getlabOrdersbyLabId,
  getClinicLabStats,
} from "../controller/LabOrder.js";

const labOrderRouter = Router();

labOrderRouter.route("/create-order").post(createLabOrder);
labOrderRouter.route("/update-status/:orderId").patch(updateOrderStatus);
labOrderRouter.route("/pending-orders/:clinicId").get(getPendingLabOrders);
labOrderRouter
  .route("/lab-orders/:clinicId")
  .get(getLabOrdersbyClinicId);
labOrderRouter
  .route("/lab-orders-status/:clinicId/:labId")
  .get(getLabOrdersStatus);
labOrderRouter
  .route("/lab-orders-by-lab/:clinicId/:labId")
  .get(getlabOrdersbyLabId);
labOrderRouter
  .route("/clinic-lab-stats/:clinicId")
  .get(getClinicLabStats);
export default labOrderRouter;

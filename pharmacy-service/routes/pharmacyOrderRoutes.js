import express from "express";
import {
  createPharmacyOrder,
  getAllPharmacyOrders,
  getPharmacyOrderById,
  updatePharmacyOrderStatus,
  deletePharmacyOrder,
} from "../controller/pharmacyOrderController.js";

const pharmacyOrderRouter = express.Router();

pharmacyOrderRouter.route("/orders").post(createPharmacyOrder);
pharmacyOrderRouter.route("/getallorders").get(getAllPharmacyOrders);
pharmacyOrderRouter.route("/orders/:id").get(getPharmacyOrderById);
pharmacyOrderRouter.route("/orders/status/:id").patch(updatePharmacyOrderStatus);
pharmacyOrderRouter.route("/orders/:id").delete(deletePharmacyOrder);
export default pharmacyOrderRouter;   
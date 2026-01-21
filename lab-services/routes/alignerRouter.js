import {
  createAlignerOrder,
  getAlignerOrderById,
  updateAlignerOrderStatus,
  getAlignerOrdersByPatientId,
  
} from "../controller/alignerController.js";
import express from "express";

const alignerRouter = express.Router();

alignerRouter.post("/create-order", createAlignerOrder);
alignerRouter.get("/order/:orderId", getAlignerOrderById);
alignerRouter.patch("/order/:orderId/update-status", updateAlignerOrderStatus);
alignerRouter.get("/patient/:patientId/orders", getAlignerOrdersByPatientId);

export default alignerRouter;

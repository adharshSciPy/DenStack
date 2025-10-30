import express from "express";
import { createPurchaseOrder, verifyPayment } from "../controller/clinicPurchaseController.js";


const clinicPurchaseRouter = express.Router();
clinicPurchaseRouter.post("/create-purchase-order", createPurchaseOrder);
clinicPurchaseRouter.post("/verify-payment", verifyPayment);

export default clinicPurchaseRouter;
import {
  createAlignerOrder,
  getAlignerOrderById,
  updateAlignerOrderStatus,
  getAlignerOrdersByPatientId,
  
} from "../controller/alignerController.js";
import express from "express";
import uploadDentalLabFiles from "../middleware/multerDentalLab.js";
const alignerRouter = express.Router();

alignerRouter.post("/create-order",  uploadDentalLabFiles.fields([
    { name: "upperFile", maxCount: 1 },
    { name: "lowerFile", maxCount: 1 },
    { name: "totalJaw", maxCount: 1 }

  ]), createAlignerOrder);
alignerRouter.get("/order/:orderId", getAlignerOrderById);
alignerRouter.patch("/order/:orderId/update-status", updateAlignerOrderStatus);
alignerRouter.get("/patient/:patientId/orders", getAlignerOrdersByPatientId);
export default alignerRouter;

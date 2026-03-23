import {
  createAlignerOrder,
  getAlignerOrderById,
  updateAlignerOrderStatus,
  getAlignerOrdersByPatientId,
  getLatestAlignerOrdersByVendorId,
  getMonthlyLabRevenueByVendor,
  updatedPaymentStatus,
  getVendorMonthlyAlignerStats,
  uploadAlignerResultFile
  
} from "../controller/alignerController.js";
import express from "express";
import uploadDentalLabFiles from "../middleware/multerDentalLab.js";
import {uploadAlignerResult} from "../middleware/alignerResultUpload.js";
const alignerRouter = express.Router();

alignerRouter.post("/create-order",  uploadDentalLabFiles.fields([
    { name: "upperFile", maxCount: 1 },
    { name: "lowerFile", maxCount: 1 },
    { name: "totalJaw", maxCount: 1 }

  ]), createAlignerOrder);
alignerRouter.get("/order/:orderId", getAlignerOrderById);
alignerRouter.patch("/order/:orderId/update-status", updateAlignerOrderStatus);
alignerRouter.get("/patient/:patientId/orders", getAlignerOrdersByPatientId);
alignerRouter.get("/vendor/latest-orders/:vendorId", getLatestAlignerOrdersByVendorId);
alignerRouter.get("/vendor/monthly-revenue/:labVendorId", getMonthlyLabRevenueByVendor);
alignerRouter.patch("/order/update-payment-status/:orderId", updatedPaymentStatus);
alignerRouter.get("/stats/monthly-aligner-stats/:vendorId", getVendorMonthlyAlignerStats);
alignerRouter.patch("/upload-aligner-result/:orderId", uploadAlignerResult.array("resultFiles", 5), uploadAlignerResultFile);
export default alignerRouter;

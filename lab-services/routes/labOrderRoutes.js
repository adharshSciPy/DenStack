import express from "express";
import { createDentalLabOrder,getLabStatsUsingClinicId,getMonthlyLabRevenueByVendor,getAllLabOrdersByClinicId,getAlignerLabOrdersByLabVendor,getDentalLabOrderById,getLabOrdersByLabVendor,getDentalLabOrders,updateDentalLabOrderStatus,uploadLabResults,getMonthlyInHouseLabRevenue,getLabStatsUsingLabVendorId,getLatestLabOrdersByClinicId} from "../controller/labOrderController.js";
import uploadDentalLabFiles from "../middleware/multerDentalLab.js";
import {uploadLabResult} from "../middleware/labResultUpload.js"


const labOrderRouter = express.Router();

labOrderRouter.route("/dental-orders").post(uploadDentalLabFiles.array("files"), createDentalLabOrder);
labOrderRouter.route("/getall-dental-orders").get(getDentalLabOrders);
labOrderRouter.route("/dental-orders/:id").get( getDentalLabOrderById);
labOrderRouter.route("/dental-orders/status/:id").patch(updateDentalLabOrderStatus);
labOrderRouter.route(
  "/dental-orders/upload-results/:id/:labOrderId",).patch(
  uploadLabResult.array("resultFiles", 1000),
  uploadLabResults
);
labOrderRouter.route("/lab/:labVendorId").get(getLabOrdersByLabVendor);
labOrderRouter.route("/clinic-dental-orders/:clinicId").get(getAllLabOrdersByClinicId);
labOrderRouter.route("/getLatest/clinic-dental-orders/:clinicId").get(getLatestLabOrdersByClinicId);
labOrderRouter.route("/lab-stats/:clinicId").get(getLabStatsUsingClinicId);
labOrderRouter.route("/lab-status/:labVendorId").get(getLabStatsUsingLabVendorId);
labOrderRouter.route("/lab-month/:clinicId").get(getMonthlyInHouseLabRevenue)
labOrderRouter.route("/aligner-orders/:labVendorId").get( getAlignerLabOrdersByLabVendor);
labOrderRouter.route("/lab-monthly-revenue/:labVendorId").get(getMonthlyLabRevenueByVendor);
export default labOrderRouter;
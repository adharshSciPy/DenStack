import express from "express";
import { createDentalLabOrder,getLabStatsUsingClinicId,getAllLabOrdersByClinicId,getDentalLabOrderById,getLabOrdersByLabVendor,getDentalLabOrders,updateDentalLabOrderStatus,uploadLabResults } from "../controller/labOrderController.js";
import uploadDentalLabFiles from "../middleware/multerDentalLab.js";
import {uploadLabResult} from "../middleware/labResultUpload.js"


const labOrderRouter = express.Router();

labOrderRouter.route("/dental-orders").post(uploadDentalLabFiles.array("attachments"), createDentalLabOrder);
labOrderRouter.route("/getall-dental-orders").get(getDentalLabOrders);
labOrderRouter.route("/dental-orders/:id").get( getDentalLabOrderById);
labOrderRouter.route("/dental-orders/status/:id").patch(updateDentalLabOrderStatus);
labOrderRouter.route(
  "/dental-orders/upload-results/:id",).patch(
  uploadLabResult.array("resultFiles", 50),
  uploadLabResults
);
labOrderRouter.route("/lab/:labVendorId").get(getLabOrdersByLabVendor);
labOrderRouter.route("/clinic-dental-orders/:clinicId").get(getAllLabOrdersByClinicId);
labOrderRouter.route("/lab-stats/:clinicId").get(getLabStatsUsingClinicId);
export default labOrderRouter;
import express from "express";

import { assignInventoryController,getClinicVendorIds,assignClinicInventoryProducts } from "../controller/assignInventoryController.js"


const assignRouter=express.Router()

assignRouter.route("/inventory/assign").post(assignInventoryController);
assignRouter.route("/inventory/assign/clinicproducts").post(assignClinicInventoryProducts);
assignRouter.route("/clinic/vendor-ids/:clinicId").get(getClinicVendorIds);
export default assignRouter
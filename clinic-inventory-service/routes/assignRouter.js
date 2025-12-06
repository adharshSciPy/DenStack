import express from "express";

import { assignInventory,getClinicVendorIds } from "../controller/assignInventoryController.js"


const assignRouter=express.Router()

assignRouter.route("/inventory/assign").post(assignInventory);
assignRouter.route("/clinic/vendor-ids/:clinicId").get(getClinicVendorIds);
export default assignRouter
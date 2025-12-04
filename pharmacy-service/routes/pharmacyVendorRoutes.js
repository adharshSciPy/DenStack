import express from "express";
import {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
  getVendorsByClinic,
} from "../controller/pharmacyVendorController.js";

const pharmacyRouter = express.Router();

pharmacyRouter.route("/vendors").post(createVendor);
pharmacyRouter.route("/vendors/status/:id").patch(updateVendor);  
pharmacyRouter.route("/all-vendors").get(getVendors);
pharmacyRouter.get("/vendors/by-clinic/:clinicId", getVendorsByClinic);
pharmacyRouter.route("/vendors/:id").delete(deleteVendor);  

export default pharmacyRouter;
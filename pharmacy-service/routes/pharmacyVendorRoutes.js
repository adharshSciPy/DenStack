import express from "express";
import {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
} from "../controller/pharmacyVendorController.js";

const pharmacyRouter = express.Router();

pharmacyRouter.route("/vendors").post(createVendor);
pharmacyRouter.route("/vendors/status/:id").patch(updateVendor);  
pharmacyRouter.route("/all-vendors").get(getVendors);
pharmacyRouter.route("/vendors/:id").delete(deleteVendor);  
export default pharmacyRouter;
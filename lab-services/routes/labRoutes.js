import { Router } from "express";
import { createLabVendor,
  getAllLabVendors,
  getLabVendorById,
  updateLabVendor,
  deleteLabVendor,
  getLabsByClinicId
 } from "../controller/labController.js";
import { verifyRole } from "../middleware/verifyAdmin.js";
 const labRouter = Router();

labRouter.route("/create-vendor").post(verifyRole(["700"]), createLabVendor);
labRouter.route("/all-vendors").get(verifyRole(["700"]), getAllLabVendors);
labRouter.route("/vendor/:id").get( verifyRole(["700"]),getLabVendorById);
labRouter.route("/update-vendor/:id").patch( verifyRole(["700","100"]),updateLabVendor);
labRouter.route("/delete-vendor/:id").delete( verifyRole(["700"]),deleteLabVendor);
labRouter.route("/clinic/:clinicId").get( getLabsByClinicId);

export default labRouter; 
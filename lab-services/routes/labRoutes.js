import { Router } from "express";
import {
  createLabVendor,
  getAllLabVendors,
  getLabVendorById,
  updateLabVendor,
  deleteLabVendor,
  createInHouseLabVendor,
  getLabByClinicId,
  getExternalLabVendors,
  getInHouseLabsByClinicId,
  createAlignerVendor,
  getAlignerVendors
} from "../controller/labController.js";
import { verifyRole } from "../middleware/verifyAdmin.js";
const labRouter = Router();

labRouter.route("/create-vendor").post(createLabVendor);
labRouter.route("/vendors/create-aligner").post(createAlignerVendor);
labRouter.route("/vendors").get(getAllLabVendors);
labRouter.route("/vendor/:id").get(getLabVendorById);
labRouter.route("/vendor/:id").patch(verifyRole(["700"]), updateLabVendor);
labRouter.route("/vendor/:id").delete(verifyRole(["700"]), deleteLabVendor);
labRouter.route("/create-inhouse-vendor").post(createInHouseLabVendor);
labRouter.route("/vendor-by-clinic/:clinicId").get(getLabByClinicId);
// labRouter.route("/inhouse-vendors").get(getInHouseLabVendors);
labRouter.route("/external-vendors").get(getExternalLabVendors);
labRouter
  .route("/inhouse-labs-by-clinic/:clinicId")
  .get(getInHouseLabsByClinicId);
labRouter.route("/aligner-vendors").get(getAlignerVendors);
export default labRouter;

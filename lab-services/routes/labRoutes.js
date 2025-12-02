import { Router } from "express";
import {
  createLabVendor,
  getAllLabVendors,
  getLabVendorById,
  updateLabVendor,
  deleteLabVendor,
  createInHouseLabVendor,
  getLabByClinicId
} from "../controller/labController.js";
import { verifyRole } from "../middleware/verifyAdmin.js";
const labRouter = Router();

labRouter.route("/create-vendor").post( createLabVendor);
labRouter.route("/vendors").get(getAllLabVendors);
labRouter.route("/vendor/:id").get(getLabVendorById);
labRouter.route("/vendor/:id").patch(verifyRole(["700"]), updateLabVendor);
labRouter.route("/vendor/:id").delete(verifyRole(["700"]), deleteLabVendor);
labRouter.route("/create-inhouse-vendor").post( createInHouseLabVendor);
labRouter.route("/vendor-by-clinic/:clinicId").get(getLabByClinicId);

export default labRouter;

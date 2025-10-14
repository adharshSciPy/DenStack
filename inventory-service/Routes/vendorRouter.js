import { Router } from "express"
import { verifyAuthToken, authorizeRoles } from "../middlewares/authMiddleware.js"
import { createVendor, vendorDetails, editVendor, deleteVendor } from "../Controller/vendorController.js"
const SUPER_ADMIN = process.env.SUPERADMIN_ROLE;

const vendorRouter = Router()

vendorRouter.post("/createVendor", verifyAuthToken, authorizeRoles(SUPER_ADMIN), createVendor);
vendorRouter.get("/allVendor", verifyAuthToken, authorizeRoles(SUPER_ADMIN), vendorDetails);
vendorRouter.put("/editVendor/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), editVendor);
vendorRouter.delete("/deleteVendor/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), deleteVendor);


export default vendorRouter;
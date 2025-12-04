import { createClinicProductAndAssignInventory,getClinicProducts,getClinicVendorIds,updateClinicProduct } from "../controller/clinicProductController.js";
import { Router } from "express";
const clinicProductRouter = Router();


clinicProductRouter.route("/create/:clinicId").post(createClinicProductAndAssignInventory);
clinicProductRouter.route("/products/:clinicId").get(getClinicProducts);
clinicProductRouter.route("/clinic/vendor-ids/:clinicId").get(getClinicVendorIds);
clinicProductRouter.route("/update/:clinicId/:productId").patch(updateClinicProduct);

export default clinicProductRouter;
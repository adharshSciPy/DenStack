import { createClinicProductAndAssignInventory,getClinicProducts,getClinicVendorIds,updateClinicProduct,getClinicLabs,getlabProducts} from "../controller/clinicProductController.js";
import { Router } from "express";
const   clinicProductRouter = Router();


clinicProductRouter.route("/create/:clinicId").post(createClinicProductAndAssignInventory);
clinicProductRouter.route("/products/:clinicId").get(getClinicProducts);
clinicProductRouter.route("/clinic/vendor-ids/:clinicId").get(getClinicVendorIds);
clinicProductRouter.route("/clinic/labs/:clinicId").get(getClinicLabs);
clinicProductRouter.route("/update/:clinicId/:productId").patch(updateClinicProduct);
clinicProductRouter.route("/lab/products/:labId").get(getlabProducts);
export default clinicProductRouter;
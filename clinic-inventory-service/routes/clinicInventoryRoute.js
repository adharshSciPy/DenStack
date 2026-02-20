import { getProducts,getLowStockProducts,deleteInventoryItem,getClinicProducts} from "../controller/clinicInventoryController.js"


import { Router } from "express";
const clinicInventoryRouter = Router();

clinicInventoryRouter.route("/products/:clinicId").get(getProducts);
clinicInventoryRouter.route("/products/low-stock/:clinicId").get(getLowStockProducts);
clinicInventoryRouter.route("/inventory/delete/:id").delete(deleteInventoryItem);
clinicInventoryRouter.route("/clinicProduct/:clinicId").get(getClinicProducts)

export default clinicInventoryRouter;
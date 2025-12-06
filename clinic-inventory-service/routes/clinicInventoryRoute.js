import { getProducts,getLowStockProducts,deleteInventoryItem } from "../controller/clinicInventoryController.js"


import { Router } from "express";
const clinicInventoryRouter = Router();

clinicInventoryRouter.route("/products/:clinicId").get(getProducts);
clinicInventoryRouter.route("/products/low-stock/:clinicId").get(getLowStockProducts);
clinicInventoryRouter.route("/inventory/delete/:id").delete(deleteInventoryItem);

export default clinicInventoryRouter;
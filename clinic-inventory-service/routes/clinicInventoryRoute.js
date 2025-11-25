import { getProducts } from "../controller/clinicInventoryController.js"


import { Router } from "express";
const clinicInventoryRouter = Router();

clinicInventoryRouter.route("/products/:clinicId").get(getProducts);

export default clinicInventoryRouter;
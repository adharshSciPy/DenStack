import { Router } from "express";
import { assignInventory } from "../controller/assignInventoryController.js"
import { clinicPurchase, markDelivered } from "../controller/clinicPurchaseController.js"


const clinicInventoryRouter=Router()

clinicInventoryRouter.route("/purchase").post(clinicPurchase);
clinicInventoryRouter.route("/inventory/assign").post(assignInventory);
clinicInventoryRouter.route("/clinic/order/mark-delivered").post(markDelivered);

export default clinicInventoryRouter
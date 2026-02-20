import { Router } from "express";
// import { assignInventory } from "../controller/assignInventoryController.js"
import { clinicPurchase, markDelivered ,getClinicOrders} from "../controller/clinicPurchaseController.js"
import { manualAddInventory } from "../controller/clinicPurchaseController.js";

const clinicInventoryRouter=Router()

clinicInventoryRouter.route("/purchase").post(clinicPurchase);
// clinicInventoryRouter.route("/inventory/assign").post(assignInventory);
clinicInventoryRouter.route("/clinic/order/mark-delivered").post(markDelivered);
clinicInventoryRouter.route("/orders/:clinicId").get( getClinicOrders);
clinicInventoryRouter.route("/inventory/manual-add").post(manualAddInventory);
export default clinicInventoryRouter
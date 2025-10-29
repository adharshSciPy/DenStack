import express from "express";
import {getClinicInventory  } from "../controller/clinicInventoryController.js";


const clinicInventoryRouter = express.Router();

clinicInventoryRouter.get("/inventory/:clinicId", getClinicInventory);

export default clinicInventoryRouter;
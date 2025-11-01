import { Router } from "express";
import { registerPRO, loginpro, allPros, fetchProById, fetchProByUniqueId, updatePRO, deletePRO } from "../controller/proController.js";

const PRORouter = Router();

PRORouter.route("/registerPRO").post(registerPRO);
PRORouter.route("/loginPRO").post(loginpro);
PRORouter.route("/allpros").get(allPros);
PRORouter.route("/prodetails/:id").get(fetchProById);
PRORouter.route("/prodetails-uniqueId/:id").get(fetchProByUniqueId);
PRORouter.route("/updatePRO/:id").put(updatePRO)
PRORouter.route("/deletePRO/:id").delete(deletePRO)

export default PRORouter;
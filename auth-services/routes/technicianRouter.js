import { Router } from "express";
import { registerTechnician, loginTechnician, allTechnicians, fetchTechnicianById, editTechnician } from "../controller/technicianController.js";


const technicianAuthRouter = Router();
technicianAuthRouter.route("/register").post(registerTechnician);
technicianAuthRouter.route("/login").post(loginTechnician);
technicianAuthRouter.route("/technicians").get(allTechnicians);
technicianAuthRouter.route("/technicianDetails/:id").get(fetchTechnicianById);
technicianAuthRouter.route("/editTechnician/:id").put(editTechnician)


export default technicianAuthRouter
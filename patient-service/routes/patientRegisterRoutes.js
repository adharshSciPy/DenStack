import { Router } from "express";
import { registerPatient } from "../controller/patientRegisterController.js";
const patientRegisterRouter=Router();
patientRegisterRouter.route("/register/:id").post(registerPatient)//{id:clinicId}
export default patientRegisterRouter;
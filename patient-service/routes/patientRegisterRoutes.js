import { Router } from "express";
import { getAllPatients, getPatientWithUniqueId, registerPatient } from "../controller/patientRegisterController.js";
const patientRegisterRouter=Router();
patientRegisterRouter.route("/register/:id").post(registerPatient)//{id:clinicId}
patientRegisterRouter.route("/single-patient").get(getPatientWithUniqueId)
patientRegisterRouter.route("/all-patients/:id").get(getAllPatients)//{id:clinicId}


export default patientRegisterRouter;
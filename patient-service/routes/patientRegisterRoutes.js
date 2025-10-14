import { Router } from "express";
import { getAllPatients, getPatientsByClinic, getPatientWithUniqueId, patientCheck, registerPatient } from "../controller/patientRegisterController.js";
const patientRegisterRouter=Router();
patientRegisterRouter.route("/register/:id").post(registerPatient)//{id:clinicId}
patientRegisterRouter.route("/single-patient").get(getPatientWithUniqueId)
patientRegisterRouter.route("/all-patients/:id").get(getAllPatients)//{id:clinicId}
patientRegisterRouter.route("/verify").post(patientCheck);
patientRegisterRouter.route("/clinic-patients/:id").get(getPatientsByClinic);//id:clinicId


export default patientRegisterRouter;
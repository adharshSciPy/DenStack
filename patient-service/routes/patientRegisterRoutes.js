import { Router } from "express";
import { getAllPatients,getPatientById, getPatientsByClinic, getPatientWithUniqueId, patientCheck, registerPatient, sendSMSLink, setPassword, login } from "../controller/patientRegisterController.js";
const patientRegisterRouter = Router();

patientRegisterRouter.route("/register/:id").post(registerPatient)//{id:clinicId}
patientRegisterRouter.route("/single-patient").get(getPatientWithUniqueId)//not mongoose id
patientRegisterRouter.route("/all-patients/:id").get(getAllPatients)//{id:clinicId}
patientRegisterRouter.route("/verify").post(patientCheck);
patientRegisterRouter.route("/clinic-patients/:id").get(getPatientsByClinic);//id:clinicId
patientRegisterRouter.route("/details/:id").get(getPatientById)//{id:patientId}
patientRegisterRouter.post("/send-login-link", sendSMSLink);
patientRegisterRouter.post("/set-password", setPassword);
patientRegisterRouter.post("/patientLogin", login);


export default patientRegisterRouter;
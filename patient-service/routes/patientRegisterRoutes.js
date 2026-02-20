import { Router } from "express";
import { getAllPatients,getPatientById, getPatientsByClinic, getPatientWithUniqueId, patientCheck, registerPatient, sendSMSLink, setPassword, login,getPatientByRandomId, addLabOrderToPatient, getPatientFullCRM, updatePatientDetails,getAllPatientsWithBirthdays, getPatientDentalChart, getVisitHistory, getPatientEncryptedLink, verifyPatientWithEncryptedId } from "../controller/patientRegisterController.js";
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
patientRegisterRouter.route("/patient-by-randomId/:id").get(getPatientByRandomId);
patientRegisterRouter.route("/lab-order/:id").patch(addLabOrderToPatient);
patientRegisterRouter.route("/full-crm").get(getPatientFullCRM);
patientRegisterRouter.route("/add/patient_details/:id").patch(updatePatientDetails)
patientRegisterRouter.route('/all-with-birthdays').get(getAllPatientsWithBirthdays);
// patientRegisterRouter.route("/:id").get(getPatientById);
patientRegisterRouter.route('/dental-chart/:patientId').get(getPatientDentalChart);
patientRegisterRouter.route('/visit-history/:id').get(getVisitHistory);
// patientRegisterRouter.route('/verify-access').get(verifyPatientAccess);
patientRegisterRouter.route('/encrypted-link/:patientId').get(getPatientEncryptedLink)
patientRegisterRouter.route('/verify-encrypted').post(verifyPatientWithEncryptedId)
export default patientRegisterRouter;
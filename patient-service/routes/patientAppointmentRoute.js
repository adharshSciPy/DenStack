import { Router } from "express";
import { createAppointment, getAppointmentById, getTodaysAppointments,getPatientHistory, addLabOrderToPatientHistory, getAppointmentsByClinic } from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
patientAppointmentRouter.route("/fetch").get(authClinicDoctor,getTodaysAppointments)
patientAppointmentRouter.route("/fetch/:id").get(getAppointmentById)
patientAppointmentRouter.route("/patient-history/:id").get(getPatientHistory);
patientAppointmentRouter.route("/lab-details/:id").patch(addLabOrderToPatientHistory);//id:patientHistoryId this api is used to add lab order details to patient history
patientAppointmentRouter.route("/clinic-appointments/:id").get(getAppointmentsByClinic);//id:clinicId

export default patientAppointmentRouter
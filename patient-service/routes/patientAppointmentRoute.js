import { Router } from "express";
import { createAppointment, getAppointmentById, getTodaysAppointments,getPatientHistory } from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
patientAppointmentRouter.route("/fetch").get(authClinicDoctor,getTodaysAppointments)
patientAppointmentRouter.route("/fetch/:id").get(getAppointmentById)
patientAppointmentRouter.route("/patient-history/:id").get(getPatientHistory);

export default patientAppointmentRouter
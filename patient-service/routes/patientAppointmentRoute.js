import { Router } from "express";
import { createAppointment, getAppointmentById, getTodaysAppointments } from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
patientAppointmentRouter.route("/fetch").get(authClinicDoctor,getTodaysAppointments)
patientAppointmentRouter.route("/fetch/:id").get(getAppointmentById)

export default patientAppointmentRouter
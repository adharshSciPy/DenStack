import { Router } from "express";
import { createAppointment, getTodaysAppointments } from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
patientAppointmentRouter.route("/fetch").get(authClinicDoctor,getTodaysAppointments)

export default patientAppointmentRouter
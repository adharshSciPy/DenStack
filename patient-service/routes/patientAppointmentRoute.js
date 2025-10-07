import { Router } from "express";
import { createAppointment } from "../controller/patientAppointmentController.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
export default patientAppointmentRouter
import { Router } from "express";
import { createAppointment, getAppointmentById, getTodaysAppointments,getPatientHistory, addLabOrderToPatientHistory, getAppointmentsByClinic, clearDoctorFromAppointments } from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
patientAppointmentRouter.route("/fetch").get(authClinicDoctor,getTodaysAppointments)
patientAppointmentRouter.route("/fetch/:id").get(getAppointmentById)
patientAppointmentRouter.route("/patient-history/:id").get(getPatientHistory);
patientAppointmentRouter.route("/lab-details/:id").patch(addLabOrderToPatientHistory);
patientAppointmentRouter.route("/clinic-appointments/:id").get(getAppointmentsByClinic);
patientAppointmentRouter.route("/remove/doctor").patch(clearDoctorFromAppointments);

export default patientAppointmentRouter
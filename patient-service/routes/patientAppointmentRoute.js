import { Router } from "express";
import { createAppointment, getAppointmentById, getTodaysAppointments,getPatientHistory, addLabOrderToPatientHistory, getAppointmentsByClinic, clearDoctorFromAppointments, appointmentReschedule, cancelAppointment } from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
import { authDoctor } from "../middleware/authDoctor.js";
const patientAppointmentRouter=Router();
patientAppointmentRouter.route("/book/:id").post(createAppointment)
patientAppointmentRouter.route("/fetch").get(authDoctor,getTodaysAppointments)
patientAppointmentRouter.route("/fetch/:id").get(getAppointmentById)
patientAppointmentRouter.route("/patient-history/:id")
  .get(getPatientHistory)
  .post(getPatientHistory); 
patientAppointmentRouter.route("/lab-details/:id").patch(addLabOrderToPatientHistory);
patientAppointmentRouter.route("/clinic-appointments/:id").get(getAppointmentsByClinic);
patientAppointmentRouter.route("/clear-doctor-from-appointments").patch(clearDoctorFromAppointments);
patientAppointmentRouter.route("/reschedule/:id").patch(appointmentReschedule);
patientAppointmentRouter.route("/cancel/:id").patch(cancelAppointment);

export default patientAppointmentRouter
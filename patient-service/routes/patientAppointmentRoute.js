// ================================
// routes/patientAppointmentRouter.js (UPDATED)
// ================================
import { Router } from "express";
import {
  createAppointment,
  getAppointmentById,
  getTodaysAppointments,
  getPatientHistory,
  addLabOrderToPatientHistory,
  getAppointmentsByClinic,
  clearDoctorFromAppointments,
  appointmentReschedule,
  cancelAppointment,
  getAppointmentsByDate,  // ✅ NEW
  getUnpaidBillsByClinic,
  addReceptionBilling, getAllAppointments,
  getMonthlyAppointmentsClinicWise,
  getPatientHistoryById
} from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
import { authDoctor } from "../middleware/authDoctor.js";
import { addPaymentToBill } from "../../billing-service/controller/billingController.js";

const patientAppointmentRouter = Router();

// Existing routes
patientAppointmentRouter.route("/book/:id").post(createAppointment);
patientAppointmentRouter.route("/fetch").get(authDoctor, getTodaysAppointments);
patientAppointmentRouter.route("/fetch/:id").get(getAppointmentById);
patientAppointmentRouter.route("/patient-history/:id")
  .get(getPatientHistory)
  .post(getPatientHistory);
patientAppointmentRouter.route("/lab-details/:id").patch(addLabOrderToPatientHistory);
patientAppointmentRouter.route("/clinic-appointments/:id").get(getAppointmentsByClinic);
patientAppointmentRouter.route("/clear-doctor-from-appointments").patch(clearDoctorFromAppointments);
patientAppointmentRouter.route("/reschedule/:id").patch(appointmentReschedule);
patientAppointmentRouter.route("/cancel/:id").patch(cancelAppointment);
patientAppointmentRouter.route("/by-date").get(getAppointmentsByDate);
patientAppointmentRouter.route("/clinic/unpaid_bills/:id").get(getUnpaidBillsByClinic);
patientAppointmentRouter.route("/update_bills").patch(addReceptionBilling);
patientAppointmentRouter.get("/allappointments", getAllAppointments);
patientAppointmentRouter.route("/monthly_appointmnets/:id").get(getMonthlyAppointmentsClinicWise)
patientAppointmentRouter.route("/visit-history/:id").get(getPatientHistoryById)
export default patientAppointmentRouter;
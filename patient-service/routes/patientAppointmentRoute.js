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
  getAppointmentsByDate,
  getUnpaidBillsByClinic,
  addReceptionBilling, getAllAppointments,
  getMonthlyAppointmentsClinicWise,
  getPatientHistoryById,
  approveRecallAppointment,
  getPatientTreatmentPlans,
  getDoctorRevenue,
  getPatientsIncomeSummary,
  approveAppointmentFromPatinetPortal
} from "../controller/patientAppointmentController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
import { authDoctor } from "../middleware/authDoctor.js";
import { addPaymentToBill } from "../../billing-service/controller/billingController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { attachPermissions } from "../middleware/attachPermission.js";
import { canReadAppointments, canWriteAppointments } from "../middleware/checkPermission.js";

const patientAppointmentRouter = Router();

// Existing routes
patientAppointmentRouter.route("/public/book/:id").post(createAppointment);// Public route for booking appointments without authentication
patientAppointmentRouter.route("/book/:id").post(verifyToken,attachPermissions,canWriteAppointments,createAppointment);
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
patientAppointmentRouter.route("/visit-history/:id").get(getPatientHistoryById);
patientAppointmentRouter.route("/recall-approval/:id").patch(approveRecallAppointment);
patientAppointmentRouter.route("/treatment-plans/:id").get(getPatientTreatmentPlans)
patientAppointmentRouter.route("/doctor-revenue").get(authDoctor,getDoctorRevenue)
patientAppointmentRouter.route("/income-summary").get(getPatientsIncomeSummary);
patientAppointmentRouter.route("/patient-portal/approve/:id").patch(approveAppointmentFromPatinetPortal);
export default patientAppointmentRouter;
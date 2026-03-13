import { Router } from "express";
import { allDoctors, fetchDoctorById, fetchDoctorByUniqueId, loginDoctor, registerDoctor, doctorStats,getDoctorsBatch,updateDoctorClinicStatus, forgotDoctorPassword, verifyDoctorOTP, resetDoctorPassword  } from "../controller/doctorController.js";


const doctorAuthRouter = Router();
doctorAuthRouter.route("/register").post(registerDoctor);
doctorAuthRouter.route("/login").post(loginDoctor);
doctorAuthRouter.route("/doctors").get(allDoctors);
doctorAuthRouter.route("/details/:id").get(fetchDoctorById);
doctorAuthRouter.route("/details-uniqueId/:id").get(fetchDoctorByUniqueId);
doctorAuthRouter.route("/doctorStats").get(doctorStats)
doctorAuthRouter.route("/doctors-batch").post(getDoctorsBatch);
doctorAuthRouter.route("/update-clinic-status").put(updateDoctorClinicStatus);
doctorAuthRouter.route("/forgot-password").post(forgotDoctorPassword);
doctorAuthRouter.route("/verify-otp").post(verifyDoctorOTP);
doctorAuthRouter.route("/reset-password").post(resetDoctorPassword);


export default doctorAuthRouter
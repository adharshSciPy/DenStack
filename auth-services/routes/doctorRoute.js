import { Router } from "express";
import { allDoctors, fetchDoctorById, fetchDoctorByUniqueId, loginDoctor, registerDoctor, doctorStats,getDoctorsBatch } from "../controller/doctorController.js";


const doctorAuthRouter = Router();
doctorAuthRouter.route("/register").post(registerDoctor);
doctorAuthRouter.route("/login").post(loginDoctor);
doctorAuthRouter.route("/doctors").get(allDoctors);
doctorAuthRouter.route("/details/:id").get(fetchDoctorById);
doctorAuthRouter.route("/details-uniqueId/:id").get(fetchDoctorByUniqueId);
doctorAuthRouter.route("/doctorStats").get(doctorStats)
doctorAuthRouter.route("/doctors-batch").post(getDoctorsBatch);



export default doctorAuthRouter
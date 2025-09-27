import { Router } from "express";
import { allDoctors, fetchDoctorById, loginDoctor, registerDoctor } from "../controller/doctorController.js";


const doctorAuthRouter=Router();
doctorAuthRouter.route("/register").post(registerDoctor);
doctorAuthRouter.route("/login").post(loginDoctor);
doctorAuthRouter.route("/doctors").get(allDoctors);
doctorAuthRouter.route("/details/:id").get(fetchDoctorById);


export default doctorAuthRouter
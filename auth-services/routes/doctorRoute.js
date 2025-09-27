import { Router } from "express";
import { loginDoctor, registerDoctor } from "../controller/doctorController.js";


const doctorAuthRouter=Router();
doctorAuthRouter.route("/register").post(registerDoctor);
doctorAuthRouter.route("/login").post(loginDoctor);

export default doctorAuthRouter
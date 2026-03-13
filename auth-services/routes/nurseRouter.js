import { Router } from "express";
import { allNurses, fetchNurseById, forgotNursePassword, loginNurse, registerNurse, resetNursePassword, verifyNurseOTP } from "../controller/nurseController.js";


const nurseAuthRouter=Router();
nurseAuthRouter.route("/register").post(registerNurse);
nurseAuthRouter.route("/login").post(loginNurse);
nurseAuthRouter.route("/nurses").get(allNurses);
nurseAuthRouter.route("/details/:id").get(fetchNurseById);
nurseAuthRouter.route("/forgot-password").post(forgotNursePassword);
nurseAuthRouter.route("/verify-otp").post(verifyNurseOTP);  
nurseAuthRouter.route("/reset-password").post(resetNursePassword);



export default nurseAuthRouter
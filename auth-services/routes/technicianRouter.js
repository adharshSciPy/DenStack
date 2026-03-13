import { Router } from "express";
import { registerTechnician, loginTechnician, allTechnicians, fetchTechnicianById, editTechnician, forgotTechnicianPassword, verifyTechnicianOTP, resetTechnicianPassword } from "../controller/technicianController.js";
import { resetDoctorPassword } from "../controller/doctorController.js";


const technicianAuthRouter = Router();
technicianAuthRouter.route("/register").post(registerTechnician);
technicianAuthRouter.route("/login").post(loginTechnician);
technicianAuthRouter.route("/technicians").get(allTechnicians);
technicianAuthRouter.route("/technicianDetails/:id").get(fetchTechnicianById);
technicianAuthRouter.route("/editTechnician/:id").put(editTechnician);
technicianAuthRouter.route("/forgot-password").post(forgotTechnicianPassword);
technicianAuthRouter.route("/verify-otp").post(verifyTechnicianOTP);    
technicianAuthRouter.route("/reset-password").post(resetTechnicianPassword);


export default technicianAuthRouter
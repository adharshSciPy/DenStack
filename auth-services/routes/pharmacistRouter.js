import { Router } from "express";
import { allPharmacists, fetchPharmacistById, forgotPharmacistPassword, loginPharmacist, registerPharmacist, resetPharmacistPassword, verifyPharmacistOTP } from "../controller/pharmacistControler.js";


const pharmacistAuthRouter=Router();
pharmacistAuthRouter.route("/register").post(registerPharmacist);
pharmacistAuthRouter.route("/login").post(loginPharmacist);
pharmacistAuthRouter.route("/pharmacists").get(allPharmacists);
pharmacistAuthRouter.route("/details/:id").get(fetchPharmacistById);
pharmacistAuthRouter.route("/forgot-password").post(forgotPharmacistPassword);
pharmacistAuthRouter.route("/verify-otp").post(verifyPharmacistOTP);
pharmacistAuthRouter.route("/reset-password").post(resetPharmacistPassword);


export default pharmacistAuthRouter
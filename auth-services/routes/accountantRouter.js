import { Router } from "express";
import { allAccountants, fetchAccountantById, forgotAccountantPassword, loginAccountant, registerAccountant, resetAccountantPassword, verifyAccountantOTP ,} from "../controller/accountantController.js";

const accountantAuthRouter=Router();

accountantAuthRouter.route("/register").post(registerAccountant);
accountantAuthRouter.route("/login").post(loginAccountant);
accountantAuthRouter.route("/accountants").get(allAccountants);
accountantAuthRouter.route("/details/:id").get(fetchAccountantById);
accountantAuthRouter.route("/forgot-password").post(forgotAccountantPassword);
accountantAuthRouter.route("/verify-otp").post(verifyAccountantOTP);
accountantAuthRouter.route("/reset-password").post(resetAccountantPassword);

export default accountantAuthRouter
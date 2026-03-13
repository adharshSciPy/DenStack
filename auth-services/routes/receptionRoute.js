import { Router } from "express";
import { allReceptions, fetchReceptionById, forgotReceptionPassword, loginReception, registerReception, resetReceptionPassword, verifyReceptionOTP } from "../controller/receptionController.js";


const receptionAuthRouter = Router();
receptionAuthRouter.route("/register").post(registerReception);
receptionAuthRouter.route("/login").post(loginReception);
receptionAuthRouter.route("/receptions").get(allReceptions);
receptionAuthRouter.route("/details/:id").get(fetchReceptionById);
receptionAuthRouter.route("/forgot-password").post(forgotReceptionPassword);
receptionAuthRouter.route("/verify-otp").post(verifyReceptionOTP);
receptionAuthRouter.route("/reset-password").post(resetReceptionPassword);



export default receptionAuthRouter;
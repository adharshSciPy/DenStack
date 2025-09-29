import { Router } from "express";
import { allReceptions, fetchReceptionById, loginReception, registerReception } from "../controller/receptionController.js";


const receptionAuthRouter = Router();
receptionAuthRouter.route("/register").post(registerReception);
receptionAuthRouter.route("/login").post(loginReception);
receptionAuthRouter.route("/receptions").get(allReceptions);
receptionAuthRouter.route("/details/:id").get(fetchReceptionById);


export default receptionAuthRouter;
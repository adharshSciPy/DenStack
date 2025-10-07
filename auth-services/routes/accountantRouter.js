import { Router } from "express";
import { allAccountants, fetchAccountantById, loginAccountant, registerAccountant ,} from "../controller/accountantController.js";

const accountantAuthRouter=Router();

accountantAuthRouter.route("/register").post(registerAccountant);
accountantAuthRouter.route("/login").post(loginAccountant);
accountantAuthRouter.route("/accountants").get(allAccountants);
accountantAuthRouter.route("/details/:id").get(fetchAccountantById);

export default accountantAuthRouter
import { Router } from "express";
import { registerLabUser,labStaffLogin} from "../controller/labUserController.js";

const labUserRouter = Router();

labUserRouter.route("/register").post(registerLabUser);
labUserRouter.route("/login").post(labStaffLogin);
export default labUserRouter;
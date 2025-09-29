import { Router } from "express";
import { allNurses, fetchNurseById, loginNurse, registerNurse } from "../controller/nurseController.js";


const nurseAuthRouter=Router();
nurseAuthRouter.route("/register").post(registerNurse);
nurseAuthRouter.route("/login").post(loginNurse);
nurseAuthRouter.route("/nurses").get(allNurses);
nurseAuthRouter.route("/details/:id").get(fetchNurseById);


export default nurseAuthRouter
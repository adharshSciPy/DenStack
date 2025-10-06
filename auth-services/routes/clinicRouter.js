import { Router } from "express";
import { editTheme, getTheme, loginClinic, registerClinic } from "../controller/clinicController.js";

const clinicAuthRoutes=Router();
clinicAuthRoutes.route("/register").post(registerClinic);
clinicAuthRoutes.route("/login").post(loginClinic);
clinicAuthRoutes.route("/gettheme/:clinicId").get(getTheme)
clinicAuthRoutes.route("/updateTheme/:clinicId").patch(editTheme)

export default clinicAuthRoutes
import { Router } from "express";
import { loginClinic, registerClinic } from "../controller/clinicController.js";

const clinicAuthRoutes=Router();
clinicAuthRoutes.route("/register").post(registerClinic);
clinicAuthRoutes.route("/login").post(loginClinic);

export default clinicAuthRoutes
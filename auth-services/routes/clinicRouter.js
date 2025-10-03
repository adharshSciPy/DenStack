import { Router } from "express";
import { loginClinic, registerClinic, viewAllClinics, viewClinicById, editClinic } from "../controller/clinicController.js";

const clinicAuthRoutes = Router();
clinicAuthRoutes.route("/register").post(registerClinic);
clinicAuthRoutes.route("/login").post(loginClinic);
clinicAuthRoutes.route("/allclinics").get(viewAllClinics);
clinicAuthRoutes.route("/viewClinic/:id").get(viewClinicById);
clinicAuthRoutes.route("/editClinic/:id").put(editClinic)

export default clinicAuthRoutes
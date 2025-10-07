import { Router } from "express";
import { editTheme, getTheme, loginClinic, registerClinic, viewAllClinics, viewClinicById, editClinic, getClinicStaffs } from "../controller/clinicController.js";

const clinicAuthRoutes = Router();
clinicAuthRoutes.route("/register").post(registerClinic);
clinicAuthRoutes.route("/login").post(loginClinic);
clinicAuthRoutes.route("/allclinics").get(viewAllClinics);
clinicAuthRoutes.route("/view-clinic/:id").get(viewClinicById);
clinicAuthRoutes.route("/editClinic/:id").put(editClinic);
clinicAuthRoutes.route("/all-staffs/:id").get(getClinicStaffs);


clinicAuthRoutes.route("/gettheme/:clinicId").get(getTheme)
clinicAuthRoutes.route("/updateTheme/:clinicId").patch(editTheme)

export default clinicAuthRoutes
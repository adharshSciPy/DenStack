import { Router } from "express";
import { allPharmacists, fetchPharmacistById, loginPharmacist, registerPharmacist } from "../controller/pharmacistControler.js";


const pharmacistAuthRouter=Router();
pharmacistAuthRouter.route("/register").post(registerPharmacist);
pharmacistAuthRouter.route("/login").post(loginPharmacist);
pharmacistAuthRouter.route("/pharmacists").get(allPharmacists);
pharmacistAuthRouter.route("/details/:id").get(fetchPharmacistById);


export default pharmacistAuthRouter
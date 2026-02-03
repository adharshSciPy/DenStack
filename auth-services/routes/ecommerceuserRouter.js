import { Router } from "express";
import { loginEcommerceUser, registerEcommerceUser } from "../controller/EcommerceUserController.js";


const EcommerceUserRoutes = Router();
EcommerceUserRoutes.route("/register").post(registerEcommerceUser);
EcommerceUserRoutes.route("/login").post(loginEcommerceUser);

export default EcommerceUserRoutes
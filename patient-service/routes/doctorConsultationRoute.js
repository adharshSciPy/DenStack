import { Router } from "express";
import { consultPatient } from "../controller/doctorConsultationController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";

const doctorConsultationRouter = Router();

doctorConsultationRouter.post("/consult-patient/:id", authClinicDoctor, consultPatient);

export default doctorConsultationRouter;

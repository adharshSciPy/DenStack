import { Router } from "express";
import { consultPatient, startTreatmentPlan } from "../controller/doctorConsultationController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";

const doctorConsultationRouter = Router();

doctorConsultationRouter.post("/consult-patient/:id", authClinicDoctor, consultPatient);
doctorConsultationRouter.post("/start-treatment/:id", authClinicDoctor,startTreatmentPlan);

export default doctorConsultationRouter;

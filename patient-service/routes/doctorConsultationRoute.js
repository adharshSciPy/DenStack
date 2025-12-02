import { Router } from "express";
import { addStageToTreatmentPlan, consultPatient, finishTreatmentPlan, startTreatmentPlan, updateProcedureStatus } from "../controller/doctorConsultationController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
import { authDoctor } from "../middleware/authDoctor.js";

const doctorConsultationRouter = Router();

doctorConsultationRouter.post("/consult-patient/:id", authDoctor, consultPatient);
doctorConsultationRouter.post("/start-treatment/:id", authDoctor,startTreatmentPlan);
doctorConsultationRouter.patch("/add-stage/:id", authDoctor, addStageToTreatmentPlan);
doctorConsultationRouter.patch("/update-procedure-status/:id/:stageIndex/:procedureIndex", authDoctor, updateProcedureStatus);
doctorConsultationRouter.patch("/finish-treatment/:id", authDoctor, finishTreatmentPlan);

export default doctorConsultationRouter;

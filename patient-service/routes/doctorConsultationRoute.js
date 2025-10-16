import { Router } from "express";
import { addStageToTreatmentPlan, consultPatient, finishTreatmentPlan, startTreatmentPlan, updateProcedureStatus } from "../controller/doctorConsultationController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";

const doctorConsultationRouter = Router();

doctorConsultationRouter.post("/consult-patient/:id", authClinicDoctor, consultPatient);
doctorConsultationRouter.post("/start-treatment/:id", authClinicDoctor,startTreatmentPlan);
doctorConsultationRouter.post("/add-stage/:id", authClinicDoctor, addStageToTreatmentPlan);
doctorConsultationRouter.patch("/update-procedure-status/:id/:stageIndex/:procedureIndex", authClinicDoctor, updateProcedureStatus);
doctorConsultationRouter.patch("/finish-treatment/:id", authClinicDoctor, finishTreatmentPlan);

export default doctorConsultationRouter;

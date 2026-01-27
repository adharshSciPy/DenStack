import { Router } from "express";
import { addStageToTreatmentPlan, completeStage, consultPatient, finishTreatmentPlan, startTreatmentPlan, updateProcedureStatus,removeProcedure,removeStage,removeTreatmentPlan, cancelTreatmentPlan,getDoctorDashboard,getWeeklyStats,getDoctorAnalytics,getCurrentMonthRevenue} from "../controller/doctorConsultationController.js";
import { authClinicDoctor } from "../middleware/authClinicDoctor.js";
import { authDoctor } from "../middleware/authDoctor.js";
import { uploadFiles } from "../middleware/multer.js";

const doctorConsultationRouter = Router();

doctorConsultationRouter.post("/consult-patient/:id", authDoctor, uploadFiles,consultPatient);
doctorConsultationRouter.post("/start-treatment/:id", authDoctor,startTreatmentPlan);
doctorConsultationRouter.patch("/add-stage/:id", authDoctor, addStageToTreatmentPlan);
doctorConsultationRouter.patch("/update-procedure-status/:id/:stageIndex/:procedureIndex", authDoctor, updateProcedureStatus);
doctorConsultationRouter.patch("/complete-stage/:id/:stageIndex",authDoctor, completeStage)
doctorConsultationRouter.patch("/finish-treatment/:id", authDoctor, finishTreatmentPlan);
doctorConsultationRouter.delete("/remove-procedure/:id/:toothNumber", authDoctor, removeProcedure);
doctorConsultationRouter.delete("/remove-stage/:id/:stageNumber", authDoctor, removeStage);
doctorConsultationRouter.delete("/remove-plan/:id", authDoctor, removeTreatmentPlan);
doctorConsultationRouter.patch("/cancel-plan/:id", authDoctor, cancelTreatmentPlan);
doctorConsultationRouter.get("/doctor-dashboard", authDoctor, getDoctorDashboard);
doctorConsultationRouter.get("/weekly-stats", authDoctor, getWeeklyStats);
doctorConsultationRouter.get("/analytics", authDoctor, getDoctorAnalytics);
doctorConsultationRouter.get("/current-month-revenue/:clinicId", getCurrentMonthRevenue);
export default doctorConsultationRouter;

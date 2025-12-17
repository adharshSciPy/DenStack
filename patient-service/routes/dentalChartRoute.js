import express from "express";
import {getPatientDentalChart,getToothHistory,addDentalProcedure,updateToothStatus,getDentalChartComparison, checkProcedureConflict,
} from "../controller/dentalChartController.js";

const dentalRouter = express.Router();

// ✅ Get complete dental chart for a patient
// GET /api/dental-chart/:patientId
dentalRouter.get("/dental_chart/:patientId", getPatientDentalChart);

// ✅ Get specific tooth history
// GET /api/dental-chart/:patientId/tooth/:toothNumber
dentalRouter.get( "/specific/tooth_history/:patientId/tooth/:toothNumber",getToothHistory
);

// ✅ Check for procedure conflicts (before adding)
// POST /api/dental-chart/:patientId/check-conflict
dentalRouter.post("/:patientId/check-conflict", checkProcedureConflict);

// ✅ Add procedure to dental chart during visit
// POST /api/dental-chart/:patientId/visit/:visitId/procedure
dentalRouter.post("/:patientId/visit/:visitId/procedure", addDentalProcedure);

// ✅ Update tooth status (extraction, crown, etc.)
// PATCH /api/dental-chart/:patientId/tooth/:toothNumber/status
dentalRouter.patch("/:patientId/tooth/:toothNumber/status", updateToothStatus);

// ✅ Get dental chart comparison (current vs planned)
// GET /api/dental-chart/:patientId/comparison/:treatmentPlanId
dentalRouter.get(
"/:patientId/comparison/:treatmentPlanId",getDentalChartComparison
);

export default dentalRouter;
